import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; /* <-- BAGONG IMPORT PARA LUMIPAT NG PAGE */
import { Coffee, Mail, Lock, Eye, EyeOff, ArrowRight, Leaf, Bean } from 'lucide-react';

/* esl/* <-- Para hindi magalit ang ESLint */
export default function Login({ setIsAuthenticated }) {
  const navigate = useNavigate(); /* <-- TINAWAG NATIN ANG TAGA-LIPAT NG PAGE */
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setIsLoading(true);
    await new Promise((res) => setTimeout(res, 1500));
    setIsLoading(false);
    
    if (email !== "staff@coffeetea.com" || password !== "password") {
      setError("Invalid credentials. Contact your manager if you need access.");
      return;
    }
    
    // --- KAPAG TAMA ANG LOGIN, ITO ANG MANGYAYARI ---
    setIsAuthenticated(true); // 1. Bubuksan ang lock sa App.jsx
    navigate('/dashboard');   // 2. Lilipat na ang page sa Dashboard!
  };

  return (
    <div className="fixed inset-0 h-screen w-screen flex flex-col md:flex-row font-sans bg-[#FBFBFA] z-50">
      
      {/* LEFT SIDE - LOGIN FORM */}
      <div className="w-full md:w-1/2 h-full flex flex-col justify-center items-center bg-[#FBFBFA] p-8">
        <div className="w-full max-w-[400px]">
          {/* Logo & Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#3D261D' }}>
              <Coffee className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-2xl font-serif" style={{ color: '#3D261D' }}>Coffee & Tea</span>
          </div>

          <h1 className="text-4xl font-bold text-[#332926] mb-2 font-serif tracking-tight">Welcome Back</h1>
          <p className="text-gray-500 text-base mb-8">Sign in to manage your inventory</p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2">
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Login Card */}
          <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/60">
            
            {/* Email Input */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@bakery.com"
                  className="block w-full pl-11 pr-3 py-3.5 border border-gray-200 rounded-xl focus:ring-[#3D261D] focus:border-[#3D261D] sm:text-sm text-gray-900 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-11 pr-11 py-3.5 border border-gray-200 rounded-xl focus:ring-[#3D261D] focus:border-[#3D261D] sm:text-sm text-gray-900 outline-none transition-all"
                />
                <div 
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-[#3D261D] transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-[#3D261D] transition-colors" />
                  )}
                </div>
              </div>
            </div>

            {/* Keep me logged in */}
            <div className="flex items-center mb-7">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-[#3D261D] focus:ring-[#3D261D] border-gray-300 rounded cursor-pointer accent-[#3D261D]"
              />
              <label 
                className="ml-2.5 block text-sm font-medium text-gray-600 cursor-pointer"
                onClick={() => setRememberMe(!rememberMe)}
              >
                Keep me logged in
              </label>
            </div>

            {/* Submit Button */}
            <button 
              type="submit"
              disabled={isLoading}
              style={{ backgroundColor: '#3D261D', color: '#FFFFFF', border: 'none', outline: 'none' }}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-xl hover:opacity-90 transition-all text-base font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                "Signing In..."
              ) : (
                <>Sign In <ArrowRight className="w-5 h-5" /></>
              )}
            </button>
          </form>

          {/* Forgot Password */}
          <div className="mt-8 text-center text-sm text-gray-500">
            Forgot your password? <a href="#" className="font-semibold transition-colors" style={{ color: '#A08D87' }}>Contact your Administrator</a>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE - BRANDING PANEL */}
      <div className="hidden md:flex w-1/2 h-full relative overflow-hidden flex-col justify-center items-center p-12 text-center text-white" style={{ backgroundColor: '#3D261D' }}>
        <Coffee className="absolute top-12 left-12 w-32 h-32 text-white/5 -rotate-12" />
        <Bean className="absolute top-24 right-20 w-24 h-24 text-white/5 rotate-45" />
        <Leaf className="absolute bottom-12 right-12 w-40 h-40 text-white/5 rotate-12" />
        <Bean className="absolute bottom-20 left-20 w-32 h-32 text-white/5 -rotate-45" />

        <div className="relative z-10 flex flex-col items-center max-w-md">
          <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm">
            <Coffee className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl font-bold mb-4 font-serif">Coffee & Tea</h2>
          <p className="text-white/80 mb-8 leading-relaxed text-lg">
            Elegant inventory management for the modern artisan. Track your beans, leaves, and brews with precision.
          </p>
          <div className="flex gap-4">
            <span className="px-5 py-2 rounded-full border border-white/20 text-sm text-white/90 backdrop-blur-sm">Premium Tools</span>
            <span className="px-5 py-2 rounded-full border border-white/20 text-sm text-white/90 backdrop-blur-sm">Artisan Focus</span>
          </div>
        </div>

        <div className="absolute bottom-8 w-full px-12 flex justify-between text-sm text-white/40">
          <span>© 2026 Coffee&Tea Inventory Systems</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white/80 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/80 transition-colors">Terms</a>
          </div>
        </div>
      </div>

    </div>
  );
}