import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
]

function MobileMenu({ pathname }: { pathname: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full">
          <Menu />
          <span className="sr-only">Open menu</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass w-44 rounded-2xl p-2">
        <nav className="flex flex-col">
          {links.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <a
                key={href}
                href={href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground"
                )}
              >
                {label}
              </a>
            )
          })}
        </nav>
      </PopoverContent>
    </Popover>
  )
}

export default MobileMenu
