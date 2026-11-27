import { campusGraph } from "./graph";
import { buildingOfNode, buildings } from "./mapData";
import { getBuildingName, getFloorName, getRoomName } from "./roomAdmin";

export interface LocationGroup {
  group: string;
  options: { id: string; name: string }[];
}

/** Map places an admin can attach to a schedule block or a faculty area. */
export function listLocationOptions(): LocationGroup[] {
  const places = campusGraph.nodes.filter((n) => n.kind === "entrance" || n.kind === "gate");
  const groups: LocationGroup[] = [
    {
      group: "Campus grounds",
      options: places
        .filter((n) => !buildingOfNode(n.id))
        .map((n) => ({ id: n.id, name: getRoomName(n.id, n.name) })),
    },
  ];
  buildings.forEach((b) =>
    b.floors.forEach((f) => {
      const options = places
        .filter((n) => buildingOfNode(n.id) === b.id && n.floor === f.floor)
        .map((n) => ({ id: n.id, name: getRoomName(n.id, n.name) }))
        .sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }));
      if (options.length) {
        groups.push({
          group: `${getBuildingName(b.id, b.name)}, ${getFloorName(b.id, f.floor)}`,
          options,
        });
      }
    }),
  );
  return groups;
}
