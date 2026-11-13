import { createContext, useContext, useEffect, useState } from "react";
import { fetchCurrentStaff } from "@/services/database";
import { setCurrentStaff as markCurrentStaff } from "@/lib/audit";
import { DEFAULT_ROLE, roleOf } from "@/lib/permissions";

const StaffContext = createContext({
  staff: null,
  role: "guest",
  authed: false,
  loading: true,
});

export const StaffProvider = ({ children }) => {
  const [state, setState] = useState({ staff: null, authed: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentStaff()
      .then((result) => {
        if (cancelled) return;
        markCurrentStaff(result.staff?.name || "管理员");
        setState({ staff: result.staff, authed: result.authed, loading: false });
      })
      .catch((error) => {
        console.error("获取当前操作人失败", error);
        if (!cancelled) setState({ staff: null, authed: false, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const role = state.staff?.role || (state.authed ? "guest" : DEFAULT_ROLE);

  return (
    <StaffContext.Provider
      value={{ staff: state.staff, role, authed: state.authed, loading: state.loading }}
    >
      {children}
    </StaffContext.Provider>
  );
};

export const useStaff = () => useContext(StaffContext);
