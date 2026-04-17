import StudioGate from "@/components/studio/StudioGate";
import OriginStudio from "@/components/studio/OriginStudio";
import {
  STUDIO_AUTH_COOKIE,
  isStudioConfigured,
  verifyStudioSessionToken,
} from "@/lib/studioAuth";
import { cookies } from "next/headers";

type StudioPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const getSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getErrorMessage = (code: string | undefined) => {
  if (code === "invalid") {
    return "That passphrase did not match.";
  }

  if (code === "config") {
    return "Studio access is not configured on this deployment yet.";
  }

  return null;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const token = cookieStore.get(STUDIO_AUTH_COOKIE)?.value;
  const isAuthed = verifyStudioSessionToken(token);

  if (!isStudioConfigured() || !isAuthed) {
    return (
      <StudioGate
        errorMessage={getErrorMessage(getSearchParam(params.error))}
        isConfigured={isStudioConfigured()}
      />
    );
  }

  return <OriginStudio />;
}
