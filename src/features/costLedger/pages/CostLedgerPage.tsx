import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  Box, Typography, Card, CardContent, Button, IconButton,
  Tooltip, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Skeleton, Select, MenuItem,
  FormControl, InputLabel, TextField
} from '@mui/material';
import {
  Search, Plus, Edit, Trash2, RefreshCw, Download, FileSpreadsheet,
  ArrowUpDown, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

import {
  fetchCostLedger,
  addCostEntry,
  updateCostEntry,
  deleteCostEntry
} from '../services/costLedger.service';
import {
  type CostLedgerEntry,
  type CostLedgerFormData
} from '../types/costLedger.types';
import CostEntryDialog from '../components/CostEntryDialog';
import { useMaterials } from '../../../context/MaterialContext';
import { fetchFinishedGoods } from '../../finishedGoods/services/finishedGoods.service';

// Formatting helpers
const fmtDate = (ts: Timestamp | undefined) => {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtMoney = (val: number | undefined) => {
  if (val === undefined || val === null) return '—';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtQty = (val: number | undefined) => {
  if (val === undefined || val === null) return '—';
  return val.toLocaleString('en-IN');
};

const CostLedgerPage = () => {
  const { getByModule, loading: materialsLoading } = useMaterials();
  const costMaterials = getByModule('costLedger');

  // Database state
  const [entries, setEntries] = useState<CostLedgerEntry[]>([]);
  const [approvedHeats, setApprovedHeats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<CostLedgerEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CostLedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters State
  const [searchHeat, setSearchHeat] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [alloyFilter, setAlloyFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'serialNo', direction: 'desc' });

  // Combine loading states
  const isTableLoading = loading || materialsLoading;

  // Load ledger data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCostLedger();
      setEntries(data);
      const fgData = await fetchFinishedGoods();
      const approved = new Set(
        fgData
          .filter((fg) => fg.manuallyApproved === true)
          .map((fg) => fg.heatNo)
      );
      setApprovedHeats(approved);
    } catch (err) {
      console.error("Failed to load cost ledger data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute unique values for dropdown filters
  const uniqueAlloys = useMemo(() => Array.from(new Set(entries.map(e => e.alloyType).filter(Boolean))).sort(), [entries]);
  const uniqueEmployees = useMemo(() => Array.from(new Set(entries.map(e => e.employeeName).filter(Boolean))).sort(), [entries]);
  const uniqueRoles = useMemo(() => Array.from(new Set(entries.map(e => e.role).filter(Boolean))).sort(), [entries]);

  // Apply filters
  const filteredData = useMemo(() => {
    return entries.filter(e => {
      // Heat No search
      if (searchHeat && !e.heatNo.toLowerCase().includes(searchHeat.toLowerCase())) {
        return false;
      }
      // Date filters
      if (startDate || endDate) {
        const eDate = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
        if (startDate && eDate < new Date(startDate)) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (eDate > end) return false;
        }
      }
      // Alloy Type Filter
      if (alloyFilter && e.alloyType !== alloyFilter) {
        return false;
      }
      // Employee Filter
      if (employeeFilter && e.employeeName !== employeeFilter) {
        return false;
      }
      // Role Filter
      if (roleFilter && e.role !== roleFilter) {
        return false;
      }
      return true;
    });
  }, [entries, searchHeat, startDate, endDate, alloyFilter, employeeFilter, roleFilter]);

  // Apply Sorting
  const sortedData = useMemo(() => {
    const dataToSort = [...filteredData];
    if (sortConfig !== null) {
      dataToSort.sort((a, b) => {
        let aVal = (a as any)[sortConfig.key];
        let bVal = (b as any)[sortConfig.key];

        // Format dates correctly for comparison
        if (sortConfig.key === 'date') {
          aVal = a.date instanceof Timestamp ? a.date.seconds : new Date(a.date).getTime();
          bVal = b.date instanceof Timestamp ? b.date.seconds : new Date(b.date).getTime();
        }

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return dataToSort;
  }, [filteredData, sortConfig]);

  // Apply Pagination
  const paginatedData = useMemo(() => {
    const offset = (currentPage - 1) * pageSize;
    return sortedData.slice(offset, offset + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchHeat, startDate, endDate, alloyFilter, employeeFilter, roleFilter, pageSize]);

  // Handle Header Click for Sorting
  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    if (entries.length === 0) {
      return { totalCost: 0, avgMatCostPerKg: 0, avgProdCostPerKg: 0, avgSellPricePerKg: 0 };
    }
    const totalCost = entries.reduce((s, e) => s + (e.totalMaterialCost || 0), 0);
    const totalIngots = entries.reduce((s, e) => s + (e.goodIngotsKg || 0), 0);
    
    const avgMatCostPerKg = totalIngots > 0 ? totalCost / totalIngots : 0;
    
    const totalProdCost = entries.reduce((s, e) => s + (e.totalProductionCost || 0), 0);
    const avgProdCostPerKg = totalIngots > 0 ? totalProdCost / totalIngots : 0;
    
    const totalSellRev = entries.reduce((s, e) => s + ((e.sellingPricePerKg || 0) * (e.goodIngotsKg || 0)), 0);
    const avgSellPricePerKg = totalIngots > 0 ? totalSellRev / totalIngots : 0;

    return { totalCost, avgMatCostPerKg, avgProdCostPerKg, avgSellPricePerKg };
  }, [entries]);

  // Open entry modal
  const openAddEntry = () => {
    setEditEntry(null);
    setDialogOpen(true);
  };

  const openEditEntry = (e: CostLedgerEntry) => {
    setEditEntry(e);
    setDialogOpen(true);
  };

  // Save changes
  const handleSave = async (formData: CostLedgerFormData) => {
    if (approvedHeats.has(formData.heatNo.trim())) {
      alert(`Heat ${formData.heatNo} is already approved to Finished Goods and cannot be modified.`);
      return;
    }
    if (editEntry) {
      await updateCostEntry(editEntry.id, formData);
    } else {
      const nextSerial = entries.length > 0
        ? Math.max(...entries.map(e => e.serialNo)) + 1
        : 1;
      await addCostEntry(formData, nextSerial);
    }
    await loadData();
  };

  // Delete cost entry
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (approvedHeats.has(deleteTarget.heatNo)) {
      alert(`Heat ${deleteTarget.heatNo} is already approved to Finished Goods and cannot be deleted.`);
      return;
    }
    setDeleting(true);
    try {
      await deleteCostEntry(deleteTarget.id);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // Exports
  const handleExportExcel = () => {
    const excelData = sortedData.map((row) => {
      const item: any = {
        'SI No': row.serialNo,
        'Heat No': row.heatNo,
        'Date': row.date instanceof Timestamp ? row.date.toDate().toLocaleDateString('en-IN') : String(row.date),
        'Alloy Type': row.alloyType,
        'Employee Name': row.employeeName,
        'Role': row.role,
        'Notified': row.notified ? 'Yes' : 'No',
      };

      // Add material columns in sequence: Qty, Rate, Amount
      costMaterials.forEach(f => {
        const mat = row.materials?.find(
          m => m.materialId === f.id || m.materialId === f.materialId || m.materialCode === f.materialCode
        );
        item[f.materialCode] = mat ? (mat.weightKg ?? 0) : 0;
        item[`${f.materialCode} Rate`] = mat ? (mat.ratePerKg ?? (mat as any).costPerKg ?? (mat as any).rate ?? 0) : 0;
        item[`${f.materialCode} Amount`] = mat ? (mat.amount ?? (mat as any).totalCost ?? 0) : 0;
      });

      // Production & Analysis
      item['Total Input (Kg)'] = row.totalInputKg || 0;
      item['Good Ingots (Kg)'] = row.goodIngotsKg || 0;
      item['Efficiency %'] = row.efficiencyPercentage || 0;
      item['Total Material Cost (₹)'] = row.totalMaterialCost || 0;
      item['Mat Cost/Kg (₹)'] = row.materialCostPerKg || 0;
      item['Labor Cost/Kg (₹)'] = row.laborCostPerKg || 0;
      item['Total Production Cost (₹)'] = row.totalProductionCost || 0;
      item['Production Cost/Kg (₹)'] = row.totalProductionCostPerKg || 0;
      item['Selling Margin %'] = row.marginPercentage || 0;
      item['Selling Price/Kg (₹)'] = row.sellingPricePerKg || 0;

      return item;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cost Ledger');
    XLSX.writeFile(workbook, `Cost_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    const csvData = sortedData.map((row) => {
      const item: any = {
        'SI No': row.serialNo,
        'Heat No': row.heatNo,
        'Date': row.date instanceof Timestamp ? row.date.toDate().toLocaleDateString('en-IN') : String(row.date),
        'Alloy Type': row.alloyType,
        'Employee Name': row.employeeName,
        'Role': row.role,
        'Notified': row.notified ? 'Yes' : 'No',
      };

      costMaterials.forEach(f => {
        const mat = row.materials?.find(
          m => m.materialId === f.id || m.materialId === f.materialId || m.materialCode === f.materialCode
        );
        item[f.materialCode] = mat ? (mat.weightKg ?? 0) : 0;
        item[`${f.materialCode} Rate`] = mat ? (mat.ratePerKg ?? (mat as any).costPerKg ?? (mat as any).rate ?? 0) : 0;
        item[`${f.materialCode} Amount`] = mat ? (mat.amount ?? (mat as any).totalCost ?? 0) : 0;
      });

      item['Total Input (Kg)'] = row.totalInputKg || 0;
      item['Good Ingots (Kg)'] = row.goodIngotsKg || 0;
      item['Efficiency %'] = row.efficiencyPercentage || 0;
      item['Total Material Cost'] = row.totalMaterialCost || 0;
      item['Mat Cost Per Kg'] = row.materialCostPerKg || 0;
      item['Labor Cost Per Kg'] = row.laborCostPerKg || 0;
      item['Total Production Cost'] = row.totalProductionCost || 0;
      item['Production Cost Per Kg'] = row.totalProductionCostPerKg || 0;
      item['Selling Margin %'] = row.marginPercentage || 0;
      item['Selling Price Per Kg'] = row.sellingPricePerKg || 0;

      return item;
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Cost_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box className="space-y-6 text-slate-800 antialiased">
      {/* ── Page Header ── */}
      <Box className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Typography className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Cost Ledger
          </Typography>
          <Typography className="text-sm text-slate-500 font-medium mt-1">
            Material Cost Analysis and Production Cost Tracking
          </Typography>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip title="Refresh Ledger">
            <IconButton onClick={loadData} disabled={loading} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg p-2.5">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
          <Button
            onClick={handleExportCSV}
            variant="outlined"
            startIcon={<Download size={16} />}
            className="text-slate-700 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 font-semibold px-4 rounded-lg h-10 text-xs"
          >
            Export CSV
          </Button>
          <Button
            onClick={handleExportExcel}
            variant="outlined"
            startIcon={<FileSpreadsheet size={16} />}
            className="text-emerald-700 border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-200 font-semibold px-4 rounded-lg h-10 text-xs"
          >
            Export Excel
          </Button>
          <Button
            onClick={openAddEntry}
            variant="contained"
            startIcon={<Plus size={16} />}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 rounded-lg h-10 text-xs shadow-md shadow-blue-500/20"
          >
            Add Cost Entry
          </Button>
        </div>
      </Box>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Material Cost', value: fmtMoney(kpis.totalCost), desc: 'Aggregated scrap metal cost', color: 'text-amber-600', border: 'border-amber-100', bg: 'bg-amber-50/35' },
          { label: 'Avg Mat Cost / Kg', value: `${fmtMoney(kpis.avgMatCostPerKg)}/Kg`, desc: 'Average metal cost per Ingot Kg', color: 'text-orange-600', border: 'border-orange-100', bg: 'bg-orange-50/35' },
          { label: 'Avg Prod Cost / Kg', value: `${fmtMoney(kpis.avgProdCostPerKg)}/Kg`, desc: 'Average operational cost per Kg', color: 'text-blue-600', border: 'border-blue-100', bg: 'bg-blue-50/35' },
          { label: 'Avg Sell Price / Kg', value: `${fmtMoney(kpis.avgSellPricePerKg)}/Kg`, desc: 'Average selling price per Kg', color: 'text-emerald-600', border: 'border-emerald-100', bg: 'bg-emerald-50/35' },
        ].map((kpi, idx) => (
          <Card key={idx} className={`border ${kpi.border} ${kpi.bg} shadow-sm rounded-xl`}>
            <CardContent className="p-5">
              <Typography className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</Typography>
              <Typography className={`text-2xl font-black ${kpi.color} mt-1.5 tracking-tight`}>{kpi.value}</Typography>
              <Typography className="text-xs text-slate-500 mt-1">{kpi.desc}</Typography>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filtering Toolbar ── */}
      <Card className="border border-slate-200 shadow-sm rounded-xl bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Search size={14} className="text-slate-400" /> Filter & Search Registry
              </span>
              {(searchHeat || startDate || endDate || alloyFilter || employeeFilter || roleFilter) && (
                <button
                  onClick={() => {
                    setSearchHeat('');
                    setStartDate('');
                    setEndDate('');
                    setAlloyFilter('');
                    setEmployeeFilter('');
                    setRoleFilter('');
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Heat Number Search */}
              <TextField
                label="Search Heat Number"
                placeholder="e.g. H-2026-001"
                size="small"
                value={searchHeat}
                onChange={(e) => setSearchHeat(e.target.value)}
                fullWidth
              />

              {/* Start Date */}
              <TextField
                label="Start Date"
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    style: { background: 'white' },
                    onClick: (e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {}
                    }
                  }
                }}
              />

              {/* End Date */}
              <TextField
                label="End Date"
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                  input: {
                    style: { background: 'white' },
                    onClick: (e) => {
                      try {
                        (e.target as any).showPicker?.();
                      } catch (err) {}
                    }
                  }
                }}
              />

              {/* Alloy Type Dropdown */}
              <FormControl size="small" fullWidth>
                <InputLabel>Alloy Type</InputLabel>
                <Select
                  value={alloyFilter}
                  label="Alloy Type"
                  onChange={(e) => setAlloyFilter(e.target.value)}
                >
                  <MenuItem value=""><em>All Alloys</em></MenuItem>
                  {uniqueAlloys.map(alloy => (
                    <MenuItem key={alloy} value={alloy}>{alloy}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Employee Dropdown */}
              <FormControl size="small" fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={employeeFilter}
                  label="Employee"
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                >
                  <MenuItem value=""><em>All Employees</em></MenuItem>
                  {uniqueEmployees.map(emp => (
                    <MenuItem key={emp} value={emp}>{emp}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Role Dropdown */}
              <FormControl size="small" fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={roleFilter}
                  label="Role"
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <MenuItem value=""><em>All Roles</em></MenuItem>
                  {uniqueRoles.map(role => (
                    <MenuItem key={role} value={role}>{role}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Spreadsheet Table ── */}
      <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full max-h-[600px] scrollbar-thin">
          <table className="min-w-full divide-y divide-slate-200 border-collapse text-left">
            <thead className="bg-slate-100 sticky top-0 z-30 shadow-sm text-slate-700 font-bold uppercase tracking-wider text-[10px]">
              {/* Header row 1: Section Labels */}
              <tr>
                <th className="px-3 py-2 text-center border-b border-r border-slate-200 sticky left-0 z-40 bg-slate-100 w-12"></th>
                <th className="px-4 py-2 text-center border-b border-r border-slate-200 sticky left-12 z-40 bg-slate-100 w-28"></th>
                <th colSpan={3} className="px-4 py-1.5 text-center border-b border-r border-slate-200 bg-slate-100/80 font-extrabold text-slate-600">
                  General Info
                </th>
                {costMaterials.map(f => (
                  <th key={f.id} colSpan={3} className="px-4 py-1.5 text-center border-b border-r border-slate-200 bg-blue-50/50 text-blue-900 font-extrabold tracking-normal">
                    {f.materialCode}
                  </th>
                ))}
                <th colSpan={3} className="px-4 py-1.5 text-center border-b border-r border-slate-200 bg-emerald-50 text-emerald-950 font-extrabold">
                  Production Section
                </th>
                <th colSpan={7} className="px-4 py-1.5 text-center border-b border-r border-slate-200 bg-amber-50 text-amber-950 font-extrabold">
                  Cost Analysis Section
                </th>
                <th className="px-4 py-2 text-center border-b border-slate-200 bg-slate-100 z-30 w-24"></th>
              </tr>

              {/* Header row 2: Field Names */}
              <tr>
                <th
                  onClick={() => requestSort('serialNo')}
                  className="px-3 py-2 text-center border-b border-r border-slate-200 sticky left-0 z-40 bg-slate-100 w-12 cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    SI NO <ArrowUpDown size={10} />
                  </div>
                </th>
                <th
                  onClick={() => requestSort('heatNo')}
                  className="px-4 py-2 text-left border-b border-r border-slate-200 sticky left-12 z-40 bg-slate-100 w-28 cursor-pointer hover:bg-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    HEAT NO <ArrowUpDown size={10} />
                  </div>
                </th>

                {/* General columns */}
                <th onClick={() => requestSort('date')} className="px-4 py-2 border-b border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors w-28">
                  <div className="flex items-center gap-1">Date <ArrowUpDown size={10} /></div>
                </th>
                <th onClick={() => requestSort('alloyType')} className="px-4 py-2 border-b border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors w-28">
                  <div className="flex items-center gap-1">Alloy <ArrowUpDown size={10} /></div>
                </th>
                <th onClick={() => requestSort('employeeName')} className="px-4 py-2 border-b border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors w-36">
                  <div className="flex items-center gap-1">Employee <ArrowUpDown size={10} /></div>
                </th>

                {/* Materials loops */}
                {costMaterials.map(f => (
                  <Fragment key={f.id}>
                    <th className="px-3 py-2 text-right border-b border-slate-200 bg-blue-50/20 font-bold w-20 text-[9px]">Qty (Kg)</th>
                    <th className="px-3 py-2 text-right border-b border-slate-200 bg-blue-50/20 font-bold w-20 text-[9px]">Rate (₹)</th>
                    <th className="px-3 py-2 text-right border-b border-r border-slate-200 bg-blue-50/20 font-bold w-24 text-[9px]">Amount (₹)</th>
                  </Fragment>
                ))}

                {/* Production totals */}
                <th className="px-4 py-2 border-b border-slate-200 bg-emerald-50/30 text-right w-24">Total Input</th>
                <th className="px-4 py-2 border-b border-slate-200 bg-emerald-50/30 text-right w-24">Good Output</th>
                <th className="px-4 py-2 border-b border-r border-slate-200 bg-emerald-50/30 text-right w-24">Yield %</th>

                {/* Cost Analysis */}
                <th className="px-4 py-2 border-b border-slate-200 bg-amber-50/30 text-right w-28">Material Cost</th>
                <th className="px-4 py-2 border-b border-slate-200 bg-amber-50/30 text-right w-24">Mat Cost/Kg</th>
                <th className="px-4 py-2 border-b border-slate-200 bg-amber-50/30 text-right w-24">Labor Cost/Kg</th>
                <th className="px-4 py-2 border-b border-slate-200 bg-amber-50/30 text-right w-28">Total Prod Cost</th>
                <th className="px-4 py-2 border-b border-slate-200 bg-amber-50/30 text-right w-28">Production Cost/Kg</th>
                <th className="px-4 py-2 border-b border-slate-200 bg-amber-50/30 text-right w-20">Margin %</th>
                <th className="px-4 py-2 border-b border-r border-slate-200 bg-amber-50/30 text-right w-28">Sell Price/Kg</th>

                {/* Actions (Edit / Delete) */}
                <th className="px-4 py-2 border-b border-slate-200 text-center w-24 sticky right-0 bg-slate-100 shadow-[left_2px_0_4px_rgba(0,0,0,0.05)]">Actions</th>
              </tr>
            </thead>

            <tbody className="bg-white divide-y divide-slate-200 text-xs">
              {isTableLoading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 sticky left-0 bg-white border-r border-slate-200 text-center"><Skeleton width={16} /></td>
                    <td className="px-3 py-2.5 sticky left-12 bg-white border-r border-slate-200 text-center"><Skeleton width={20} /></td>
                    <td className="px-4 py-2.5 sticky left-24 bg-white border-r border-slate-200 font-bold"><Skeleton width={60} /></td>
                    {Array.from({ length: 3 + (costMaterials.length * 3) + 3 + 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-2.5 border-r border-slate-100"><Skeleton width={40} /></td>
                    ))}
                    <td className="px-4 py-2.5 sticky right-0 bg-white text-center"><Skeleton width={50} /></td>
                  </tr>
                ))
              ) : filteredData.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={5 + (costMaterials.length * 3) + 3 + 6 + 1} className="px-4 py-12 text-center text-slate-400 font-medium bg-slate-50">
                    {searchHeat || alloyFilter || employeeFilter || startDate || endDate
                      ? "No records match the active search filters."
                      : "No cost entries recorded yet. Click 'Add Cost Entry' to get started."}
                  </td>
                </tr>
              ) : (
                // Ledger Records
                paginatedData.map((row, index) => {
                  const isEven = index % 2 === 0;
                  const rowBg = isEven
                    ? 'bg-white'
                    : 'bg-slate-50/30';

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-blue-50/20 transition-colors group ${rowBg}`}
                    >
                      {/* SI No */}
                      <td className={`px-3 py-2 text-center border-r border-slate-200 sticky left-0 z-20 font-mono text-slate-500 font-bold ${isEven ? 'bg-white' : 'bg-slate-50/70'} group-hover:bg-blue-50`}>
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>

                      {/* Heat No */}
                      <td className={`px-4 py-2 border-r border-slate-200 sticky left-12 z-20 font-bold text-blue-700 ${isEven ? 'bg-white' : 'bg-slate-50/70'} group-hover:bg-blue-50`}>
                        {row.heatNo}
                      </td>

                      {/* General Values */}
                      <td className="px-4 py-2 border-r border-slate-100 whitespace-nowrap">{fmtDate(row.date)}</td>
                      <td className="px-4 py-2 border-r border-slate-100">
                        <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded text-[10px]">
                          {row.alloyType}
                        </span>
                      </td>
                      <td className="px-4 py-2 border-r border-slate-100 whitespace-nowrap font-medium text-slate-700">{row.employeeName || '—'}</td>

                      {/* Materials Loops */}
                      {costMaterials.map(f => {
                        const mat = row.materials?.find(
                          m => m.materialId === f.id || m.materialId === f.materialId || m.materialCode === f.materialCode
                        );
                        const qty = mat ? (mat.weightKg ?? 0) : 0;
                        const rate = mat ? ((mat as any).rate ?? mat.ratePerKg ?? (mat as any).costPerKg ?? 0) : 0;
                        const amt = mat ? (mat.amount ?? (mat as any).totalCost ?? 0) : 0;

                        return (
                          <Fragment key={f.id}>
                            <td className="px-3 py-2 text-right border-slate-100 bg-slate-50/5 font-mono text-slate-600">{qty > 0 ? fmtQty(qty) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 text-right border-slate-100 bg-slate-50/5 font-mono text-slate-500">{qty > 0 ? fmtMoney(rate) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2 text-right border-r border-slate-100 bg-blue-50/5 font-mono font-semibold text-slate-700">{qty > 0 ? fmtMoney(amt) : <span className="text-slate-300">—</span>}</td>
                          </Fragment>
                        );
                      })}

                      {/* Production Section */}
                      <td className="px-4 py-2 bg-emerald-50/5 font-mono text-right font-semibold text-slate-700">{fmtQty(row.totalInputKg)}</td>
                      <td className="px-4 py-2 bg-emerald-50/5 font-mono text-right font-bold text-emerald-800">{fmtQty(row.goodIngotsKg)}</td>
                      <td className="px-4 py-2 bg-emerald-50/5 border-r border-slate-200 font-mono text-right">
                        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${row.efficiencyPercentage >= 90 ? 'bg-emerald-100 text-emerald-800' :
                          row.efficiencyPercentage >= 75 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                          {row.efficiencyPercentage.toFixed(2)}%
                        </span>
                      </td>

                      {/* Cost Analysis Section */}
                      <td className="px-4 py-2 bg-amber-50/5 font-mono text-right font-bold text-amber-700">{fmtMoney(row.totalMaterialCost)}</td>
                      <td className="px-4 py-2 bg-amber-50/5 font-mono text-right font-semibold text-slate-700">{fmtMoney(row.materialCostPerKg)}</td>
                      <td className="px-4 py-2 bg-amber-50/5 font-mono text-right font-semibold text-slate-700">{fmtMoney(row.laborCostPerKg)}</td>
                      <td className="px-4 py-2 bg-amber-50/5 font-mono text-right font-bold text-slate-700">{fmtMoney(row.totalProductionCost)}</td>
                      <td className="px-4 py-2 bg-amber-50/5 font-mono text-right font-bold text-amber-850">{fmtMoney(row.totalProductionCostPerKg)}</td>
                      <td className="px-4 py-2 bg-amber-50/5 font-mono text-right font-semibold text-slate-600">{row.marginPercentage}%</td>
                      <td className="px-4 py-2 bg-amber-50/5 border-r border-slate-200 font-mono text-right font-black text-emerald-800">
                        {fmtMoney(row.sellingPricePerKg)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2 text-center sticky right-0 bg-slate-50 border-l border-slate-200 flex items-center justify-center gap-1.5 shadow-[left_2px_0_4px_rgba(0,0,0,0.03)] h-[41px] min-h-[41px] w-24">
                        {approvedHeats.has(row.heatNo) ? (
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                            Locked
                          </span>
                        ) : (
                          <>
                            <Tooltip title="Edit Cost Entry">
                              <IconButton size="small" onClick={() => openEditEntry(row)} className="text-blue-600 hover:bg-blue-50 p-1">
                                <Edit size={14} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Cost Entry">
                              <IconButton size="small" onClick={() => setDeleteTarget(row)} className="text-red-500 hover:bg-red-50 p-1">
                                <Trash2 size={14} />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Table Footer (Pagination) ── */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[10, 25, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>records</span>
            </div>
            <span>|</span>
            <span>Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} records</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1 || loading}
              className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              const isCurrent = p === currentPage;
              return (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  disabled={loading}
                  className={`px-3 py-1.5 border rounded transition-colors ${isCurrent
                    ? 'bg-blue-600 border-blue-600 text-white font-bold'
                    : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-600'
                    }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-600 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Dialog Form ── */}
      <CostEntryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editEntry={editEntry}
      />

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { className: "rounded-xl text-slate-800" } }}
      >
        <DialogTitle className="font-bold text-lg pb-1.5 flex items-center gap-1.5">
          <X className="text-red-500" size={20} /> Delete Cost Entry
        </DialogTitle>
        <DialogContent>
          <Typography className="text-sm text-slate-600">
            Are you sure you want to delete the Cost Ledger record for heat{' '}
            <strong className="text-slate-800">{deleteTarget?.heatNo}</strong>? This will permanently delete the entry from the registry and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions className="px-6 pb-4 pt-1 gap-2">
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" className="text-slate-600 border-slate-300 hover:bg-slate-100 rounded-lg px-4" disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="contained" className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-5 font-semibold" disabled={deleting}>
            {deleting ? <CircularProgress size={16} className="text-white" /> : 'Delete Record'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CostLedgerPage;
