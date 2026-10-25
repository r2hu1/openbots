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
            nativeButton={false}
            variant="ghost"
            className="text-muted-foreground"
            render={<Link href="#features" />}
          >
            Features
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            className="text-muted-foreground"
            render={
              <Link
                href="https://github.com/r2hu1/openbots/blob/main/DOCUMENTATION.md"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Docs
          </Button>

          <Button
            nativeButton={false}
            variant="ghost"
            className="text-muted-foreground"
            render={
              <Link
                href="https://github.com/r2hu1/openbots/blob/main/SELF_HOST.md"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Self-Hosting
          </Button>

          <Button
            variant="ghost"
            className="text-muted-foreground"
            nativeButton={false}
            render={
              <Link
                href="https://github.com/r2hu1/openbots/fork"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Fork
          </Button>
        </ButtonGroup>
        <div className="flex items-center gap-1">
          <Button
            nativeButton={false}
            render={
              <Link
                href="https://github.com/r2hu1/openbots"
                target="_blank"
                rel="noreferrer"
              />
            }
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
