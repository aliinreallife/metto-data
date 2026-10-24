import tehranStations from "../../../data/cities/tehran/stations.json";
import tehranLines from "../../../data/cities/tehran/lines.json";
import tehranGraph from "../../../data/cities/tehran/graph.json";
import mashhadStations from "../../../data/cities/mashhad/stations.json";
import mashhadLines from "../../../data/cities/mashhad/lines.json";
import mashhadGraph from "../../../data/cities/mashhad/graph.json";
import { buildCatalog } from "./catalog";
export const catalog = buildCatalog([
  {
    id: "tehran",
    names: { fa: "تهران", en: "Tehran" },
    candidate: false,
    stations: tehranStations,
    lines: tehranLines,
    graph: tehranGraph,
  },
  {
    id: "mashhad",
    names: { fa: "مشهد", en: "Mashhad" },
    candidate: true,
    stations: mashhadStations,
    lines: mashhadLines,
    graph: mashhadGraph,
    allowedLineIds: ["mashhad:line:1", "mashhad:line:2"],
  },
]);
