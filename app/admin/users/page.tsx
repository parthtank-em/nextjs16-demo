import { Suspense } from "react";
import UsersTable from "@/components/admin/users-table";
import UsersTableSkeleton from "@/components/admin/users-table-skeleton";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const awaitedSearchParams = await searchParams;
  const page = Number(awaitedSearchParams.page) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage users and send invitations
          </p>
        </div>
      </div>

      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTable page={page} />
      </Suspense>
    </div>
  );
}
