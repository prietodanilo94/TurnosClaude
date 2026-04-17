export default function JefeSucursalPage({ params }: { params: { branchId: string } }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Sucursal</h1>
      <p className="text-sm text-gray-500 mt-1 font-mono">{params.branchId}</p>
    </div>
  );
}
