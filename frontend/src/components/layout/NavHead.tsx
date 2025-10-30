import React from "react";

interface NavTitleProps {
  title: string | React.ReactNode;
  description: string;
}

export default function NavHeadComp({ title, description }: NavTitleProps) {
  return (
    <>
      <div className="w-full bg-gray-200 py-2 space-y-1 font-manrope text-center lg:hidden">
        <h1 className="font-medium">{title}</h1>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </>
  );
}
