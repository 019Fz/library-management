// Shows its children inside the top bar. Use it in any page rendered inside AppLayout:
//   <TopBarActions><SearchBox ... /></TopBarActions>
// The children still belong to the page (same state and context); only their place on screen changes.
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";

export default function TopBarActions({ children }) {
  const { actionsSlot } = useOutletContext();
  // The slot element exists after the first render of AppLayout; until then nothing is shown
  return actionsSlot ? createPortal(children, actionsSlot) : null;
}
