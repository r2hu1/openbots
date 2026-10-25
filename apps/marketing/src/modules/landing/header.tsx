import { ButtonGroup } from "@openbots/ui/components/button-group"
import Logo from "../shared/logo"
import { Button } from "@openbots/ui/components/button"
import Link from "next/link"
import { ArrowUpRight } from "reicon-react"
import ThemeSwitcher from "../shared/theme-switcher"

export default function Header() {
  return (
    <header className="p-4">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <ButtonGroup className="hidden sm:flex">
          <Button
            variant="ghost"
            className="text-muted-foreground"
            nativeButton={false}
            render={<Link href="https://github.com/r2hu1/openbots" />}
          >
            Contribute
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            className="text-muted-foreground"
            render={<Link href="https://github.com/r2hu1/openbots" />}
          >
            Features
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            className="text-muted-foreground"
            render={<Link href="https://github.com/r2hu1/openbots" />}
          >
            Docs
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            className="text-muted-foreground"
            render={<Link href="https://github.com/r2hu1/openbots" />}
          >
            Fork
          </Button>
        </ButtonGroup>
        <div className="flex items-center gap-1">
          <Button
            nativeButton={false}
            render={<Link href="https://github.com/r2hu1/openbots" />}
          >
            Get Started
            <ArrowUpRight />
          </Button>
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}
