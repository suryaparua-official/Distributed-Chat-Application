"use client";
import { useAppData, API_BASE } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import toast from "react-hot-toast";
import Loading from "@/components/Loading";
import { ArrowLeft, Save, User, UserCircle } from "lucide-react";

const ProfilePage = () => {
  const { user, isAuth, loading, setUser } = useAppData();

  const [isEdit, setIsEdit] = useState(false);
  const [name, setName] = useState<string | undefined>("");

  const router = useRouter();

  const editHandler = () => {
    setIsEdit(!isEdit);
    setName(user?.name);
  };

  const submitHandler = async (e: any) => {
    e.preventDefault();
    const token = Cookies.get("token");

    try {
      const { data } = await axios.post(
        `${API_BASE}/api/v1/update/user`,
        { name },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      Cookies.set("token", data.token, {
        expires: 15,
        secure: false,
        path: "/",
      });

      toast.success(data.message);
      setUser(data.user);
      setIsEdit(false);
    } catch (error: any) {
      toast.error(error.response.data.message);
    }
  };

  useEffect(() => {
    if (!isAuth && !loading) {
      router.push("/login");
    }
  }, [isAuth, router, loading]);

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-[#111b21] text-white">
      {/* Top Header */}
      <div className="flex items-center gap-4 px-6 py-4 bg-[#202c33] border-b border-[#2a3942] shadow-md">
        <button
          onClick={() => router.push("/chat")}
          className="p-2 rounded-full hover:bg-[#2a3942] transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-300" />
        </button>
        <h1 className="text-[18px] font-semibold tracking-wide">Profile</h1>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Avatar Section */}
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-linear-to-br from-[#2a3942] to-[#202c33] flex items-center justify-center shadow-lg">
              <UserCircle className="w-20 h-20 text-gray-300" />
            </div>
            <span className="absolute bottom-3 right-3 w-5 h-5 bg-[#00a884] rounded-full border-4 border-[#111b21]" />
          </div>

          <h2 className="mt-6 text-xl font-semibold">{user?.name || "User"}</h2>
          <p className="text-sm text-gray-400 mt-1">Active now</p>
        </div>

        {/* Divider */}
        <div className="my-10 border-t border-[#2a3942]" />

        {/* Profile Card */}
        <div className="bg-[#202c33] rounded-xl shadow-lg border border-[#2a3942] p-6">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-4">
            Display Name
          </p>

          {isEdit ? (
            <form onSubmit={submitHandler} className="space-y-5">
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#111b21] border border-[#2a3942]
                  rounded-lg px-4 py-3 text-sm text-white
                  focus:outline-none focus:ring-2 focus:ring-[#00a884]
                  transition"
                />
                <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5
                  rounded-full text-sm font-medium
                  bg-[#00a884] hover:bg-[#029e7d]
                  transition shadow-md"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>

                <button
                  type="button"
                  onClick={editHandler}
                  className="px-6 py-2.5 rounded-full text-sm font-medium
                  bg-[#2a3942] hover:bg-[#324b57]
                  transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between bg-[#111b21] px-4 py-4 rounded-lg border border-[#2a3942]">
              <span className="text-sm tracking-wide">
                {user?.name || "Not set"}
              </span>

              <button
                onClick={editHandler}
                className="text-sm font-medium text-[#00a884] hover:underline"
              >
                Edit
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
