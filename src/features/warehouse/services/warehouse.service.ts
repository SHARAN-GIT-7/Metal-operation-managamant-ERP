import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/firebaseConfig';
import type { InventoryItem, MaterialReceipt } from '../types/warehouse.types';

const INVENTORY_COL = 'inventory';
const RECEIPTS_COL = 'materialReceipts';

// ─── Fetch all inventory items ────────────────────────────────────────────────
export const fetchInventory = async (): Promise<InventoryItem[]> => {
  const q = query(collection(db, INVENTORY_COL), orderBy('materialCode', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as InventoryItem[];
};

// ─── Fetch all material receipts ──────────────────────────────────────────────
export const fetchMaterialReceipts = async (): Promise<MaterialReceipt[]> => {
  const q = query(collection(db, RECEIPTS_COL), orderBy('dateReceived', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      materials: Array.isArray(data.materials) ? data.materials : [],
      totalReceivedWeightKg: data.totalReceivedKg ?? data.totalReceivedWeightKg ?? 0,
      totalReturnedWeightKg: data.totalReturnedKg ?? data.totalReturnedWeightKg ?? 0,
      totalNetIntakeWeightKg: data.netIntakeKg ?? data.totalNetIntakeWeightKg ?? 0,
    } as MaterialReceipt;
  });
};

// ─── Update inventory item (admin override) ───────────────────────────────────
export const updateInventoryItem = async (
  id: string,
  updates: Partial<Pick<InventoryItem, 'minimumStockKg' | 'currentStockKg' | 'averageCost'>>
): Promise<void> => {
  await updateDoc(doc(db, INVENTORY_COL, id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

// ─── Delete a material receipt ────────────────────────────────────────────────
export const deleteMaterialReceipt = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, RECEIPTS_COL, id));
};
