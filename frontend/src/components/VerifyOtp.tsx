"use client";
import axios from "axios";
import { ArrowRight, ChevronLeft, Loader2, Lock } from "lucide-react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import Cookies from "js-cookie";
import { useAppData, API_BASE } from "@/context/AppContext";
import Loading from "./Loading";
import toast from "react-hot-toast";

const VerifyOtp = () => {
  const {
    isAuth,
    setIsAuth,
    setUser,
    loading: userLoading,
    fetchChats,
    fetchUsers,
  } = useAppData();

  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string>("");
  const [resendLoading, setResendLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const email: string = searchParams.get("email") || "";

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleInputChange = (index: number, value: string): void => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLElement>,
  ): void => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const patedData = e.clipboardData.getData("text");
    const digits = patedData.replace(/\D/g, "").slice(0, 6);
    if (digits.length === 6) {
      const newOtp = digits.split("");
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { data } = await axios.post(`${API_BASE}/api/v1/verify`, {
        email,
        otp: otpString,
      });

      toast.success(data.message);
      Cookies.set("token", data.token, {
        expires: 15,
        secure: false,
        path: "/",
      });

      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setUser(data.user);
      setIsAuth(true);
      fetchChats();
      fetchUsers();
    } catch (error: any) {
      setError(error.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API_BASE}/api/v1/login`, {
        email,
      });
      toast.success(data.message);
      setTimer(60);
    } catch (error: any) {
      setError(error.response.data.message);
    } finally {
      setResendLoading(false);
    }
  };

  if (userLoading) return <Loading />;
  if (isAuth) redirect("/chat");

  return (
    <div className="min-h-screen bg-[#111b21] flex items-center justify-center px-4 text-white">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="relative text-center mb-10">
          <button
            className="absolute left-0 top-0 p-2 rounded-md hover:bg-[#202c33] transition"
            onClick={() => router.push("/login")}
          >
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          </button>

          <div className="w-16 h-16 bg-[#00a884] rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
            <Lock size={26} className="text-white" />
          </div>

          <h1 className="text-2xl font-semibold mb-2">Verify your email</h1>
          <p className="text-gray-400 text-sm">
            Enter the 6-digit code sent to
          </p>
          <p className="text-[#00a884] text-sm font-medium mt-1 break-all">
            {email}
          </p>
        </div>

        {/* OTP Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el: HTMLInputElement | null) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-12 h-14 text-center text-xl font-semibold
                bg-[#202c33] border border-[#2a3942]
                rounded-md focus:border-[#00a884]
                focus:ring-1 focus:ring-[#00a884]
                outline-none transition"
              />
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#00a884] hover:bg-[#029e7d]
            py-3 rounded-full font-medium
            transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                Verify
                <ArrowRight className="w-4 h-4" />
              </div>
            )}
          </button>
        </form>

        {/* Resend Section */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm mb-2">Didn’t receive the code?</p>

          {timer > 0 ? (
            <p className="text-gray-400 text-sm">Resend in {timer}s</p>
          ) : (
            <button
              disabled={resendLoading}
              onClick={handleResendOtp}
              className="text-[#00a884] text-sm font-medium hover:underline disabled:opacity-50"
            >
              {resendLoading ? "Sending..." : "Resend code"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyOtp;
