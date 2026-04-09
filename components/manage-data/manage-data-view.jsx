"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Database } from "lucide-react";
import { useState } from "react";
import ProviderSetup from "./provider-setup";
import ProviderServiceCodeSetup from "./provider-service-code-setup";
import ServiceCodeSetup from "./service-code-setup";
import DiagnosisCodeSetup from "./diagnosis-code-setup";
import TreatmentTypesSetup from "./treatment-types-setup";
import DocumentTypesSetup from "./document-types-setup";

export default function ManageDataView() {
  const [tab, setTab] = useState("provider");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-6 w-6 text-teal-600" />
            <div>
              <CardTitle className="text-xl">Manage Data</CardTitle>
              <p className="text-sm text-slate-500">
                Central setup for providers, service codes, diagnosis data, and more.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="provider">Provider</TabsTrigger>
          <TabsTrigger value="providerServiceCode">Provider Service Code</TabsTrigger>
          <TabsTrigger value="serviceCode">Service Code</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
          <TabsTrigger value="treatmentTypes">Treatment Types</TabsTrigger>
          <TabsTrigger value="documentTypes">Document Types</TabsTrigger>
        </TabsList>

        <TabsContent value="provider" className="mt-4">
          <ProviderSetup />
        </TabsContent>

        <TabsContent value="providerServiceCode" className="mt-4">
          <ProviderServiceCodeSetup />
        </TabsContent>

        <TabsContent value="serviceCode" className="mt-4">
          <ServiceCodeSetup />
        </TabsContent>

        <TabsContent value="diagnosis" className="mt-4">
          <DiagnosisCodeSetup />
        </TabsContent>

        <TabsContent value="treatmentTypes" className="mt-4">
          <TreatmentTypesSetup />
        </TabsContent>

        <TabsContent value="documentTypes" className="mt-4">
          <DocumentTypesSetup />
        </TabsContent>
      </Tabs>
    </div>
  );
}


