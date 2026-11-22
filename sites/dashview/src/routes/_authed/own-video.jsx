import { createFileRoute } from "@tanstack/react-router";
import UploadReelPage from "./_own-video-page";

export const Route = createFileRoute("/_authed/own-video")({
  component: UploadReelPage,
  head: () => ({ meta: [{ title: "ריל מהסרטונים שלי · Plania Studio" }] }),
});
