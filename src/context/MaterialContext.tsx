import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeMaterials } from '../features/masterController/services/materialMaster.service';
import type { MaterialMaster } from '../features/masterController/types/materialMaster.types';

interface MaterialContextValue {
  materials: MaterialMaster[];
  activeMaterials: MaterialMaster[];
  loading: boolean;
  getByModule: (module: 'warehouse' | 'production' | 'costLedger' | 'reports') => MaterialMaster[];
  getById: (id: string) => MaterialMaster | undefined;
  getByCode: (code: string) => MaterialMaster | undefined;
}

const MaterialContext = createContext<MaterialContextValue | null>(null);

export const MaterialProvider = ({ children }: { children: ReactNode }) => {
  const [materials, setMaterials] = useState<MaterialMaster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeMaterials((data) => {
      setMaterials(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const activeMaterials = materials.filter((m) => m.status === 'Active');

  const getByModule = (module: 'warehouse' | 'production' | 'costLedger' | 'reports') => {
    return activeMaterials.filter((m) => {
      switch (module) {
        case 'warehouse':   return m.showInWarehouse;
        case 'production':  return m.showInProduction;
        case 'costLedger':  return m.showInCostLedger;
        case 'reports':     return m.showInReports;
        default:            return true;
      }
    });
  };

  const getById = (id: string) => materials.find((m) => m.id === id);
  const getByCode = (code: string) => materials.find((m) => m.materialCode === code);

  return (
    <MaterialContext.Provider value={{ materials, activeMaterials, loading, getByModule, getById, getByCode }}>
      {children}
    </MaterialContext.Provider>
  );
};

export const useMaterials = (): MaterialContextValue => {
  const ctx = useContext(MaterialContext);
  if (!ctx) throw new Error('useMaterials must be used within MaterialProvider');
  return ctx;
};
