import { Link } from "react-router-dom";
import {
  HiOutlineX,
  HiOutlineUsers,
  HiOutlineChartBar,
  HiOutlineCog,
} from "react-icons/hi";
import { LuInbox } from "react-icons/lu";
import { GrUserPolice } from "react-icons/gr";
import { LuLayoutDashboard } from "react-icons/lu";
import { IoFlagOutline } from "react-icons/io5";
import { LuMessageSquareMore } from "react-icons/lu";
import { HiOutlineArrowPath } from "react-icons/hi2";
import NavText from "./NavText";
import Logo from "../assets/uniclaim_logo.png";
import clsx from "clsx";
import { useEffect, useState, useMemo } from "react";
import { useMessage } from "@/context/MessageContext";
import { useAdminPosts } from "@/hooks/usePosts";
import type { Post } from "@/types/Post";

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
  // Hook to detect mobile screen width
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

  // Get admin posts to count turnover items
  const { posts = [] } = useAdminPosts();

  // Get total unread message count
  const { totalUnreadCount = 0 } = useMessage();

  // Filter posts for campus security management (same logic as CampusSecurityManagementPage)
  const campusSecurityPostsCount = useMemo(() => {
    return posts.filter((post: Post) => {
      // Show ALL found items turned over to Campus Security (not just awaiting confirmation)
      // This includes all turnover statuses: declared, confirmed, not_received, transferred
      return (
        post.type === "found" &&
        post.turnoverDetails &&
        post.turnoverDetails.turnoverAction === "turnover to Campus Security"
      );
    }).length;
  }, [posts]);

  // Filter posts for turnover management (same logic as TurnoverManagementPage)
  const turnoverPostsCount = useMemo(() => {
    return posts.filter((post: Post) => {
      // Show only Found items marked for turnover to OSA that need confirmation
      return (
        post.type === "found" &&
        post.turnoverDetails &&
        post.turnoverDetails.turnoverAction === "turnover to OSA" &&
        post.turnoverDetails.turnoverStatus === "declared"
      );
    }).length;
  }, [posts]);
  const flaggedPostsCount = useMemo(() => {
    return posts.filter((post: Post) => post.isFlagged === true).length;
  }, [posts]);

  // Filter posts for unclaimed posts count
  const unclaimedPostsCount = useMemo(() => {
    return posts.filter(
      (post: Post) =>
        post.status === "unclaimed" || Boolean(post.movedToUnclaimed)
    ).length;
  }, [posts]);

  // Lock scroll on body only for mobile nav open
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
        {/* Desktop Sidebar */}
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
                isOpen && "my-1"
              )}
              iconClassName="text-navyblue"
              textClassName="text-navyblue font-semi-bold font-albert-sans"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue font-albert-sans font-semibold text-base"
              hoverContainerBgClass="bg-brand"
            />
            {isOpen && (
              <p className="text-sm font-manrope font-semibold mt-2">
                Admin Menu
              </p>
            )}

            <NavText
              icon={<HiOutlineChartBar className="size-6 stroke-[1.5px]" />}
              label="Analytics"
              to="/admin/analytics"
              isOpen={isOpen}
              className="hover:bg-gray-100 mt-2"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<HiOutlineUsers className="size-6 stroke-[1.5px]" />}
              label="Manage Users"
              to="/admin/users"
              isOpen={isOpen}
              className=" hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
            />

            <NavText
              icon={<LuMessageSquareMore className="size-6 stroke-[1.5px]" />}
              label="Messages"
              to="/admin/messages"
              isOpen={isOpen}
              className="mt-2 hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
              badge={totalUnreadCount > 0 ? totalUnreadCount : undefined}
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
              badge={flaggedPostsCount > 0 ? flaggedPostsCount : undefined}
            />

            <NavText
              icon={<LuInbox className="size-6 stroke-[1.5px]" />}
              label="Unclaimed Items"
              to="/admin/unclaimed-posts"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
              badge={unclaimedPostsCount > 0 ? unclaimedPostsCount : undefined}
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
              icon={<HiOutlineArrowPath className="size-6 stroke-[1.5px]" />}
              label="Manage Turnover"
              to="/admin/turnover"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
              badge={turnoverPostsCount > 0 ? turnoverPostsCount : undefined}
            />

            <NavText
              icon={<GrUserPolice className="size-6 stroke-1" />}
              label="Campus Security"
              to="/admin/campus-security"
              isOpen={isOpen}
              className="hover:bg-gray-100"
              iconClassName="text-black"
              textClassName="text-black"
              tooltipIconClassName="text-navyblue text-xl"
              tooltipTextClassName="text-navyblue text-base"
              hoverContainerBgClass="bg-gray-100"
              badge={
                campusSecurityPostsCount > 0
                  ? campusSecurityPostsCount
                  : undefined
              }
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
                  icon={<HiOutlineChartBar className="size-6 stroke-[1.5px]" />}
                  label="Analytics"
                  to="/admin/analytics"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />

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
                  icon={
                    <LuMessageSquareMore className="size-6 stroke-[1.5px]" />
                  }
                  label="Messages"
                  to="/admin/messages"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                  badge={totalUnreadCount > 0 ? totalUnreadCount : undefined}
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
                  badge={flaggedPostsCount > 0 ? flaggedPostsCount : undefined}
                />

                <NavText
                  icon={<LuInbox className="size-6 stroke-[1.5px]" />}
                  label="Unclaimed Items"
                  to="/admin/unclaimed-posts"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                  badge={
                    unclaimedPostsCount > 0 ? unclaimedPostsCount : undefined
                  }
                />

                <NavText
                  icon={<HiOutlineCog className="size-6 stroke-[1.5px]" />}
                  label="System Cleanup"
                  to="/admin/cleanup"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                />

                <NavText
                  icon={
                    <HiOutlineArrowPath className="size-6 stroke-[1.5px]" />
                  }
                  label="Turnover Management"
                  to="/admin/turnover"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                  badge={
                    turnoverPostsCount > 0 ? turnoverPostsCount : undefined
                  }
                />

                <NavText
                  icon={<GrUserPolice className="size-6 stroke-[1.5px]" />}
                  label="Campus Security"
                  to="/admin/campus-security"
                  isOpen={isOpen}
                  onClick={onMobNavClose}
                  className="hover:bg-gray-50 rounded pl-4 justify-start"
                  iconClassName="text-black"
                  textClassName="font-manrope"
                  badge={
                    campusSecurityPostsCount > 0
                      ? campusSecurityPostsCount
                      : undefined
                  }
                />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
