import { currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { leadMagnetCreateRequest, leadMagnetUpdateRequest } from "./schema";
import { prismadb } from "@/lib/prismadb";
import { z } from "zod";
import slugify from "slugify";

//function to generate unique slug 
async function generateUniqueSlug(baseSlug: string, userId: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existingLeadMagnet = await prismadb.leadMagnet.findFirst({
      where: {
        userId,
        slug,
      },
    });

    if (!existingLeadMagnet) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

async function handleRequest(
  request: Request,
  schema: z.ZodType<any, any>,
  isUpdate = false
) {
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const requestBody = await request.json();

    // Set default slug if not provided, need to be added before zod validation
    if (!requestBody.slug) {
      requestBody.slug = slugify(requestBody.title || requestBody.name || 'default-slug', { lower: true });
    }

    const parsed = schema.safeParse(requestBody);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error, data: null },
        { status: 400 }
      );
    }

    if (isUpdate && parsed.data.userId !== userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const baseSlug = parsed.data.slug;
    const uniqueSlug = await generateUniqueSlug(baseSlug, userId);

    const data = {
      ...parsed.data,
      userId: userId,
      slug: uniqueSlug,
    };

    const updatedLeadMagnet = isUpdate
      ? await prismadb.leadMagnet.update({ where: { id: data.id }, data })
      : await prismadb.leadMagnet.create({ data });

    return NextResponse.json(
      {
        message: "Successfully handled lead magnet change!",
        data: updatedLeadMagnet,
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (error) {
    console.error("Error handling lead magnet request:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export const POST = (request: Request) =>
  handleRequest(request, leadMagnetCreateRequest);
export const PUT = (request: Request) =>
  handleRequest(request, leadMagnetUpdateRequest, true);

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "No id provided", success: false },
        { status: 400 }
      );
    }

    const leadMagnet = await prismadb.leadMagnet.findFirst({
      where: { id },
    });

    if (!leadMagnet) {
      return NextResponse.json(
        { message: "Lead magnet not found", success: false },
        { status: 404 }
      );
    }
    const user = await currentUser();

    if (!user || !user.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (leadMagnet.userId !== user.id)
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });

    await prismadb.leadMagnet.delete({ where: { id } });

    return NextResponse.json(
      {
        message: "Successfully deleted lead magnet",
        success: true,
      },
      { status: 202 }
    );
  } catch (error) {
    console.error("Error deleting lead magnet:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
