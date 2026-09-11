// Build milestone scripts (scaffolds; full logic lands with the importer port).
// build.ts:          pnpm build [--city tehran] → importers/<city> → validators → data/cities/<city>/*
// validate.ts:       pnpm validate [--city tehran] → validators/validate.ts + contributions check
// contributions-validate.ts: schema + referential check, no dataset mutation
// new-contribution.ts:       pnpm contributions:new --city tehran --entity tehran:station:tajrish
// add-city.ts:       pnpm tsx scripts/add-city.ts --city mashhad --mode metro
export {};
