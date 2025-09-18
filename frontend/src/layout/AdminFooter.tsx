export default function AdminFooter() {
  return (
    <div 
      className="fixed z-10 bottom-0 bg-gray-200 flex items-center justify-center font-manrope h-9 pl-4 w-full text-gray-500"
      style={{ bottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <h1 className="text-xs">© 2025 Team UniClaim - Admin Panel. All rights reserved.</h1>
    </div>
  );
}
