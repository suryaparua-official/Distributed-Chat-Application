"use client";
import Loading from "@/components/Loading";
import { useAppData, user_service } from "@/context/AppContext";
import axios from "axios";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { redirect, useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

const LoginPage = () => {
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const { isAuth, loading: userLoading } = useAppData();

  const handleSubmit = async (
    e: React.FormEvent<HTMLElement>,
  ): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await axios.post(`${user_service}/api/v1/login`, {
        email,
      });

      toast.success(data.message);
      router.push(`/verify?email=${email}`);
    } catch (error: any) {
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) return <Loading />;
  if (isAuth) return redirect("/chat");

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center px-4 text-white">
      <div className="w-full max-w-sm">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-[#00a884] rounded-full flex items-center justify-center">
            <Mail size={28} className="text-white" />
          </div>

          <h1 className="mt-6 text-2xl font-semibold">Welcome to ChatApp</h1>

          <p className="mt-2 text-sm text-gray-400 text-center">
            Enter your email to receive a verification code
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="block text-xs text-gray-400 mb-2 uppercase tracking-wide"
            >
              Email Address
            </label>

            <input
              type="email"
              id="email"
              className="w-full bg-[#202c33] border border-[#2a3942]
              rounded-md px-4 py-3 text-sm
              placeholder-gray-400
              focus:outline-none focus:border-[#00a884]"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00a884] hover:bg-[#029e7d]
            text-white py-3 rounded-md text-sm font-medium
            transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending code...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                Continue
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
