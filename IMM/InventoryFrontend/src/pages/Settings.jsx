export default function Settings() {
  return (
    <div className="w-full p-8 bg-[#F7F4F0] min-h-screen">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold text-[#1C100A] tracking-tight"
              style={{ fontFamily: "serif" }}
            >
              Settings
            </h1>
            <p className="text-xs text-[#9E8A7A] mt-0.5 hidden sm:block">Application configuration and preferences</p>
          </div>
        </div>
      </div>
    </div>
  );
}
