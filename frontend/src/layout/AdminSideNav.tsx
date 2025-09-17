import { Link } from "react-router-dom";
import {
  HiOutlineHome,
  HiOutlineX,
  HiOutlineUsers,
  HiOutlineTicket,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineFlag,
} from "react-icons/hi";
import { HiOutlineEnvelope, HiOutlineSpeakerWave } from "react-icons/hi2";
import { LuLayoutDashboard } from "react-icons/lu";
import NavText from "./NavText";
import Logo from "../assets/uniclaim_logo.png";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { IoFlagOutline } from "react-icons/io5";

interface AdminSideNavProps {
  isOpen: boolean;
  onClose: () => void;
  isSideNavMobileOpen: boolean;
  onMobNavClose: () => void;
}

export default function AdminSideNav({
  isOpen,
  isSideNavMobileOpen,
  onMobNavClose,
}: AdminSideNavProps) {
  // ✅ Hook to detect mobile screen width
  function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return isMobile;
  }

  const isMobile = useIsMobile();

  // ✅ Lock scroll on body only for mobile nav open
  useEffect(() => {
    if (isMobile && isSideNavMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMobile, isSideNavMobileOpen]);

  return (
    <>
      <div className="flex overflow-x-hidden relative">
        {/* ✅ Desktop Sidebar */}
        <aside
          className={`fixed top-0 left-0 hidden z-20 bg-white text-black pt-22 px-4.5 h-full ${
            isOpen ? "w-60" : "w-21"
          } lg:block`}
        >
          <div className="flex flex-col gap-2">
            <NavText
              icon={<LuLayoutDashboard className="size-6 stroke-[1.5px]" />}
              label="Dashboard"
              to="/admin"
              isOpen={isOpen}
              className={clsx(
                "bg-brand px-4 rounded-lg hover:bg-yellow-600",
                isOpen && "my-1 mb-3"
              )}
              iconClassName="text-navyblue"
              textClassName="text-navyblue font-semi-bold font-albert-sans"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue font-albert-sans font-semibold text-base"
              hoverContainerBgClass="bg-brand"
            />
            {isOpen && (
              <p className="text-sm font-manrope font-semibold">Admin Menu</p>
            )}
            <NavText
              icon={<HiOutlineUsers className="size-6 stroke-[1.5px]" />}
              label="Manage Users"
              to="/admin/users"
              isOpen={isOpen}
              className="mt-2 hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<HiOutlineEnvelope className="size-6 stroke-[1.5px]" />}
              label="Messages"
              to="/admin/messages"
              isOpen={isOpen}
              className="mt-2 hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<HiOutlineSpeakerWave className="size-6 stroke-[1.5px]" />}
              label="Announcements"
              to="/admin/announcements"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<IoFlagOutline className="size-6 stroke-[1.5px]" />}
              label="Flagged Posts"
              to="/admin/flagged-posts"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<HiOutlineCog className="size-6 stroke-[1.5px]" />}
              label="System Cleanup"
              to="/admin/cleanup"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<HiOutlineChartBar className="size-6 stroke-[1.5px]" />}
              label="Analytics"
              to="/admin/analytics"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />
          </div>
        </aside>

        {/* ✅ Mobile Sidebar */}
        <div>
          <aside
            className={`fixed top-0 left-0 z-50 bg-white text-black h-full w-full lg:hidden
            transform transition-transform duration-300 ease-in-out
            ${isSideNavMobileOpen ? "translate-x-0" : "-translate-x-full"}
          `}
          >
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-1">
                <img src={Logo} alt="Logo" className="size-8" />
                <h1 className="font-albert-sans font-bold text-xl text-blue-950">
                  <span className="text-brand">Uni</span>Claim
                </h1>
                <span className="text-sm text-gray-600 ml-2">Admin</span>
              </div>
              <HiOutlineX
                className="w-6 h-6 cursor-pointer text-black hover:text-brand transition-color duration-300"
                onClick={onMobNavClose}
              />
            </div>

            <div className="px-6 font-manrope">
              <div className="w-fit mt-2 mb-6">
                <div className="flex items-center justify-center bg-brand font-albert-sans gap-2 py-3 px-4 rounded-md hover:bg-yellow-600 transition-colors duration-300">
                  <LuLayoutDashboard className="size-6 stroke-[1.5px]" />
                  <Link to="/admin" onClick={onMobNavClose}>
                    Dashboard
                  </Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-base font-semibold mb-4.5">Admin Menu</p>
                <NavText
                  icon={<HiOutlineUsers className="size-6 stroke-[1.5px]" />}
                  label="Manage Users"
                  to="/admin/users"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />

                <NavText
                  icon={<HiOutlineEnvelope className="size-6 stroke-[1.5px]" />}
                  label="Messages"
                  to="/admin/messages"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />

                <NavText
                  icon={
                    <HiOutlineSpeakerWave className="size-6 stroke-[1.5px]" />
                  }
                  label="Announcements"
                  to="/admin/announcements"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />

                <NavText
                  icon={<IoFlagOutline className="size-6 stroke-[1.5px]" />}
                  label="Flagged Posts"
                  to="/admin/flagged-posts"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />

                <NavText
                  icon={<HiOutlineChartBar className="size-6 stroke-[1.5px]" />}
                  label="Analytics"
                  to="/admin/analytics"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
