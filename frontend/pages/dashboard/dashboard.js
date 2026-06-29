import { renderNavbar } from "../../components/navbar.js";
import { bindBackButtons, renderSidebar } from "../../components/sidebar.js";

renderNavbar();
renderSidebar({ active: "dashboard", variant: "admin" });
bindBackButtons();
