import { ListPageSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return <ListPageSkeleton rows={5} cols={["w-[30%]", "w-[12%]", "w-[12%]", "ml-auto w-[90px]"]} />;
}
