// Shows its children inside the top bar. Use it in any page rendered inside AppLayout:
//   <TopBarActions><SearchBox ... /></TopBarActions>
// The children still belong to the page (same state and context); only their place on screen changes.
import { createPortal } from "react-dom";
import { useOutletContext } from "react-router-dom";

export default function TopBarActions({ children }) {
  const context = useOutletContext();
  // Nothing is shown if there is no context (a guard did not pass it on) or the slot does not exist yet.
  // The slot element exists after the first render of AppLayout.
  const slot = context?.actionsSlot;
  return slot ? createPortal(children, slot) : null;
}
