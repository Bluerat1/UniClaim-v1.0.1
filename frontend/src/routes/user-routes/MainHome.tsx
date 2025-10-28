import { useState } from "react";
import { Outlet } from "react-router-dom";

// screens
import SideNav from "../../layout/SideNav";
import Header from "../../layout/HomeHeader";
import Footer from "../../layout/FooterComp";

export default function MainHome() {
  const [isSideBarOpen, setIsSideBarOpen] = useState(false);

  return (
    <div className="flex bg-gray-100 min-h-screen transition-colors duration-300">
      {/* Sidebar */}
      <div
        className={`hidden transition-all duration-300 ${
          isSideBarOpen ? "md:basis-0" : "md:basis-0"
        } bg-red-100 md:block`}
      >
        <SideNav
          isOpen={isSideBarOpen}
          onClose={() => setIsSideBarOpen(false)}
          isSideNavMobileOpen={isSideBarOpen}
          onMobNavClose={() => setIsSideBarOpen(false)}
        />
      </div>

      {/* Mobile Sidebar */}
      <div>
        <SideNav
          isOpen={isSideBarOpen}
          onClose={() => setIsSideBarOpen(false)}
          isSideNavMobileOpen={isSideBarOpen}
          onMobNavClose={() => setIsSideBarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div
        className={`flex transition-all duration-300 w-full ${
          isSideBarOpen ? "lg:ml-57" : "lg:ml-21"
        } md:w-full`}
      >
        <Header
          sideBarOpen={isSideBarOpen}
          sideNavClick={() => setIsSideBarOpen(!isSideBarOpen)}
        />
        <main className="mt-18 mb-0">
          <Outlet />
        </main>
        <div
          className={`flex flex-col flex-1 transition-all duration-300 w-full ${
            isSideBarOpen ? "md:ml-0 overflow-hidden" : "md:-ml-0"
          }`}
        >
          <Footer />
        </div>
      </div>
    </div>
  );
}
