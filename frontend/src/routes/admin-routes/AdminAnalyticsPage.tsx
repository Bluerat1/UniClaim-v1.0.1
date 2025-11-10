import React from "react";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import PageWrapper from "@/components/layout/PageWrapper";
import NavHeader from "@/components/layout/NavHead";

const AdminAnalyticsPage: React.FC = () => {
  // Add proper title and description for the page
  const pageTitle = "Analytics Dashboard";
  const pageDescription = "View and analyze lost and found item statistics";

  return (
    <PageWrapper title={pageTitle}>
      <div className="w-full mb-9">
        <div className="hidden p-4 sm:px-6 lg:px-8 lg:flex items-center justify-between bg-gray-50 border-b border-zinc-200">
          <div className="flex flex-row gap-3 items-center">
            <h1 className="text-base font-medium text-gray-900">{pageTitle}</h1>
            <div className="bg-blue-100 text-blue-800 text-[10px] py-1 px-2 rounded-full">
              Admin View
            </div>
          </div>
          <div className="flex items-center">
            <p className="text-xs text-gray-500">{pageDescription}</p>
          </div>
        </div>

        <NavHeader title={pageTitle} description={pageDescription} />

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gray-50 rounded-lg">
          <div className="bg-white rounded-lg shadow-xs border border-gray-100">
            <div className="p-4 sm:p-6">
              <AnalyticsDashboard />
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default AdminAnalyticsPage;
