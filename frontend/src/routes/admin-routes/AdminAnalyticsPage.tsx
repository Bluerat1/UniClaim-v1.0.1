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
      <NavHeader title={pageTitle} description={pageDescription} />
      <div className="container mx-auto px-4 py-6">
        <AnalyticsDashboard />
      </div>
    </PageWrapper>
  );
};

export default AdminAnalyticsPage;
