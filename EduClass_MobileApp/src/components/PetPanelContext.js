import { createContext, useContext, useState, useMemo, useCallback } from 'react';
const PetContext = createContext(null);
export const usePetPanel = () => useContext(PetContext);
export function PetPanelProvider({children}) {
  const [request,setRequest] = useState(0);
  const [snapshot,setSnapshot] = useState(null);
  const openPanel = useCallback(()=>setRequest(v=>v+1),[]);
  const value = useMemo(()=>({request,snapshot,setSnapshot,openPanel}),[request,snapshot,openPanel]);
  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}
