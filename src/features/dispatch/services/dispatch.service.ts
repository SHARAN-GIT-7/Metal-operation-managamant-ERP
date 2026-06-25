import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import type { DispatchEntry, DispatchFormData, DispatchItem } from '../types/dispatch.types';
import type { FinishedGoodEntry, FinishedGoodStatus } from '../../finishedGoods/types/finishedGoods.types';

const COL = 'dispatchLedger';
const FG_COL = 'finishedGoods';

// ─── Generate dispatch number ──────────────────────────────────────────────────
const generateDispatchNumber = (existingDispatches: DispatchEntry[]): string => {
  const maxNum = existingDispatches.reduce((max, d) => {
    const num = parseInt(d.dispatchNumber.replace('DSP-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `DSP-${String(maxNum + 1).padStart(4, '0')}`;
};

export const fetchDispatches = async (): Promise<DispatchEntry[]> => {
  const q = query(collection(db, COL), orderBy('dispatchDate', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      dispatchNumber: data.dispatchNumber || `DSP-${d.id.slice(0, 5).toUpperCase()}`,
    } as DispatchEntry;
  });
};

// ─── Sync finished goods weights after a dispatch change ──────────────────────
// Recalculates dispatched/remaining for each finishedGoodsId across ALL dispatches.
const syncFinishedGoodsWeights = async (finishedGoodsIds: string[]): Promise<void> => {
  if (finishedGoodsIds.length === 0) return;

  // For each affected finishedGoodsId, sum up all dispatches
  const allDispSnap = await getDocs(collection(db, COL));
  const allDispatches = allDispSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DispatchEntry));

  const batch = writeBatch(db);

  for (const fgId of finishedGoodsIds) {
    // Get the finished goods doc
    const fgRef = doc(db, FG_COL, fgId);
    const fgSnap = await getDoc(fgRef);
    if (!fgSnap.exists()) continue;

    const fg = { id: fgSnap.id, ...fgSnap.data() } as FinishedGoodEntry;
    const goodOutputKg = fg.goodOutputKg ?? 0;
    const numberOfPieces = fg.numberOfPieces ?? 0;

    // Sum up ALL dispatches for this fgId
    let totalDispatchedKg = 0;
    let totalDispatchedPieces = 0;
    for (const dispatch of allDispatches) {
      for (const item of dispatch.dispatchItems ?? []) {
        if (item.finishedGoodsId === fgId) {
          totalDispatchedKg += Number(item.dispatchWeightKg) || 0;
          totalDispatchedPieces += Number(item.dispatchPieces) || 0;
        }
      }
    }

    const remainingKg = Math.max(0, goodOutputKg - totalDispatchedKg);
    const remainingPieces = Math.max(0, numberOfPieces - totalDispatchedPieces);

    let status: FinishedGoodStatus = 'Available';
    if (totalDispatchedKg === 0 && totalDispatchedPieces === 0) {
      status = 'Available';
    } else if (remainingKg <= 0 || remainingPieces <= 0) {
      status = 'Fully Dispatched';
    } else {
      status = 'Partially Dispatched';
    }

    batch.update(fgRef, {
      dispatchedWeightKg: totalDispatchedKg,
      dispatchedPieces: totalDispatchedPieces,
      remainingWeightKg: remainingKg,
      remainingPieces,
      status,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
};

// ─── Add a new dispatch ────────────────────────────────────────────────────────
export const addDispatch = async (
  form: DispatchFormData,
  existingDispatches: DispatchEntry[],
  createdBy: string,
): Promise<string> => {
  const now = serverTimestamp() as Timestamp;
  const dispatchNumber = generateDispatchNumber(existingDispatches);

  // Build items with numeric coercions
  const items: DispatchItem[] = form.dispatchItems.map((i) => ({
    finishedGoodsId: i.finishedGoodsId,
    heatNo: i.heatNo,
    availableWeightKg: Number(i.availableWeightKg) || 0,
    availablePieces: Number(i.availablePieces) || 0,
    dispatchWeightKg: Number(i.dispatchWeightKg) || 0,
    dispatchPieces: Number(i.dispatchPieces) || 0,
  }));

  const totalDispatchWeightKg = items.reduce((s, i) => s + i.dispatchWeightKg, 0);
  const totalDispatchPieces = items.reduce((s, i) => s + i.dispatchPieces, 0);

  const ref = await addDoc(collection(db, COL), {
    dispatchNumber,
    dispatchDate: Timestamp.fromDate(new Date(form.dispatchDate)),
    customerId: form.customerId,
    customerName: form.customerName.trim(),
    alloyType: form.alloyType.trim(),
    dispatchItems: items,
    totalDispatchWeightKg,
    totalDispatchPieces,
    vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
    driverName: form.driverName.trim(),
    remarks: form.remarks.trim(),
    createdBy,
    createdAt: now,
    updatedAt: now,
  });

  // Sync finished goods
  const fgIds = [...new Set(items.map((i) => i.finishedGoodsId))];
  await syncFinishedGoodsWeights(fgIds);

  return ref.id;
};

// ─── Update a dispatch ─────────────────────────────────────────────────────────
export const updateDispatch = async (
  id: string,
  form: DispatchFormData,
  updatedBy: string,
): Promise<void> => {
  const items: DispatchItem[] = form.dispatchItems.map((i) => ({
    finishedGoodsId: i.finishedGoodsId,
    heatNo: i.heatNo,
    availableWeightKg: Number(i.availableWeightKg) || 0,
    availablePieces: Number(i.availablePieces) || 0,
    dispatchWeightKg: Number(i.dispatchWeightKg) || 0,
    dispatchPieces: Number(i.dispatchPieces) || 0,
  }));

  const totalDispatchWeightKg = items.reduce((s, i) => s + i.dispatchWeightKg, 0);
  const totalDispatchPieces = items.reduce((s, i) => s + i.dispatchPieces, 0);

  // Get original to figure out which FG ids were affected
  const originalSnap = await getDoc(doc(db, COL, id));
  const originalItems: DispatchItem[] = (originalSnap.data()?.dispatchItems ?? []) as DispatchItem[];
  const originalFgIds = originalItems.map((i) => i.finishedGoodsId);

  await updateDoc(doc(db, COL, id), {
    dispatchDate: Timestamp.fromDate(new Date(form.dispatchDate)),
    customerId: form.customerId,
    customerName: form.customerName.trim(),
    alloyType: form.alloyType.trim(),
    dispatchItems: items,
    totalDispatchWeightKg,
    totalDispatchPieces,
    vehicleNumber: form.vehicleNumber.trim().toUpperCase(),
    driverName: form.driverName.trim(),
    remarks: form.remarks.trim(),
    updatedBy,
    updatedAt: serverTimestamp(),
  });

  // Sync all affected finished goods (old + new)
  const allFgIds = [...new Set([...originalFgIds, ...items.map((i) => i.finishedGoodsId)])];
  await syncFinishedGoodsWeights(allFgIds);
};

// ─── Delete a dispatch ─────────────────────────────────────────────────────────
export const deleteDispatch = async (id: string): Promise<void> => {
  // Get dispatch items before deleting, to sync FG afterwards
  const snap = await getDoc(doc(db, COL, id));
  const items: DispatchItem[] = (snap.data()?.dispatchItems ?? []) as DispatchItem[];
  const fgIds = [...new Set(items.map((i) => i.finishedGoodsId))];

  await deleteDoc(doc(db, COL, id));

  // Sync finished goods after deletion
  await syncFinishedGoodsWeights(fgIds);
};
