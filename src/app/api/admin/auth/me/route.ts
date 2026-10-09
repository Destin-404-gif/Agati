import { NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/admin-api";
import { requireStaff } from "@/lib/staff";

export async function GET() {
  try {
    const staff = await requireStaff();
    return NextResponse.json({
      staff: {
        id: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role,
        roleName: staff.roleName,
        isActive: staff.isActive,
        lastLoginAt: staff.lastLoginAt,
        permissions: staff.permissions,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
