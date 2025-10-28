import { Link } from "react-router-dom";
import {
  HiOutlineHome,
  HiOutlineTicket,
  HiOutlineX,
  HiOutlinePencil,
} from "react-icons/hi";
import { HiOutlineEnvelope } from "react-icons/hi2";
import { FiSend } from "react-icons/fi";
import NavText from "./NavText";
import { IoIosInformationCircleOutline } from "react-icons/io";
import Logo from "../assets/uniclaim_logo.png";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useMessage } from "../context/MessageContext";

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
  isSideNavMobileOpen: boolean;
  onMobNavClose: () => void;
}

export default function SideNav({
  isOpen,
  isSideNavMobileOpen,
  onMobNavClose,
}: SideNavProps) {
  const { totalUnreadCount } = useMessage();

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
          className={`fixed top-0 left-0 hidden z-30 bg-white text-black pt-22 px-4.5 h-full ${
            isOpen ? "w-57" : "w-21"
          } lg:block`}
        >
          <div className="flex flex-col gap-2">
            <NavText
              icon={<HiOutlinePencil className="size-6 stroke-[1.5px]" />}
              label="Report an Item"
              to="/report"
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
              <p className="text-sm font-manrope font-semibold">Menu</p>
            )}
            <NavText
              icon={<HiOutlineHome className="size-6 stroke-[1.5px]" />}
              label="Home"
              to="/"
              isOpen={isOpen}
              className="mt-2 hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />
            <NavText
              icon={<HiOutlineTicket className="size-6 stroke-[1.5px]" />}
              label="My Tickets"
              to="/ticket"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />
            <div className="relative">
              <NavText
                icon={<FiSend className="size-6 stroke-[1.5px]" />}
                label="Messages"
                to="/messages"
                isOpen={isOpen}
                className="hover:bg-gray-100"
                iconClassName="text-black"
                textClassName="text-black"
                tooltipIconClassName="text-navyblue text-xl"
                tooltipTextClassName="text-navyblue text-base"
                hoverContainerBgClass="bg-gray-100"
              />
              {totalUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center z-10">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              )}
            </div>
            <NavText
              icon={<HiOutlineEnvelope className="size-6 stroke-[1.5px]" />}
              label="Contact Us"
              to="/contact_us"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />
          </div>
          {isOpen && (
            <p className="text-sm font-manrope font-semibold mt-6 mb-2">
              Know More
            </p>
          )}
          <NavText
            icon={
              <IoIosInformationCircleOutline className="size-6 stroke-[1px]" />
            }
            label="About UniClaim"
            to="/aboutuniclaim"
            isOpen={isOpen}
            className="hover:bg-gray-100"
            iconClassName="text-black"
            textClassName="text-black font-albert-sans"
            tooltipIconClassName="text-xl"
            tooltipTextClassName="font-albert-sans text-base"
            hoverContainerBgClass="bg-gray-100"
          />
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
              </div>
              <HiOutlineX
                className="w-6 h-6 cursor-pointer text-black hover:text-brand transition-color duration-300"
                onClick={onMobNavClose}
              />
            </div>

            <div className="px-6 font-manrope">
              <div className="w-fit mt-2 mb-6">
                <div className="flex items-center justify-center bg-brand font-albert-sans gap-2 py-3 px-4 rounded-md hover:bg-yellow-600 transition-colors duration-300">
                  <HiOutlinePencil className="size-5" />
                  <Link to="/report" onClick={onMobNavClose}>
                    Report an item
                  </Link>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-base font-semibold mb-4.5">Menu</p>
                <NavText
                  icon={<HiOutlineHome className="size-6 stroke-[1.5px]" />}
                  label="Home"
                  to="/"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />
                <NavText
                  icon={<HiOutlineTicket className="size-6 stroke-[1.5px]" />}
                  label="My Tickets"
                  to="/ticket"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />
                <div className="relative">
                  <NavText
                    icon={<FiSend className="size-6 stroke-[1.5px]" />}
                    label="Messages"
                    to="/messages"
                    isOpen={isOpen}
                    onClick={onMobNavClose}
                    className="hover:bg-gray-50 rounded pl-4 justify-start"
                    iconClassName="text-black"
                    textClassName="font-manrope"
                  />
                  {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center z-10">
                      {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                    </span>
                  )}
                </div>
                <NavText
                  icon={<HiOutlineEnvelope className="size-6 stroke-[1.5px]" />}
                  label="Contact Us"
                  to="/contact_us"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />
              </div>

              <p className="text-base font-semibold mt-8 mb-4.5">Know More</p>
              <NavText
                icon={
                  <IoIosInformationCircleOutline className="size-6 stroke-[1.5px]" />
                }
                label="About UniClaim"
                to="aboutuniclaim"
                isOpen={isOpen}
                onClick={onMobNavClose}
                className="hover:bg-gray-50 rounded pl-4 justify-start"
                iconClassName="text-black"
                textClassName="font-manrope"
              />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
