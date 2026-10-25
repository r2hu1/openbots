import { Blobatar } from "@openbots/ui/components/ui/blobatar"

export default function Logo() {
  return (
    <div className="flex items-center gap-1">
      <Blobatar
        name="OpenBots"
        blobatar={{
          animate: "always",
          traits: {
            shape: 0.11,
            "body.r": 0.463,
            "body.rot": 0.908,
            "poly.round": 0.8,
          },
        }}
      />
      <span className="text-[14px] font-medium">OpenBots</span>
    </div>
  )
}
