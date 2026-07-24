"use client"

interface PlaceholderSurveyProps {
  title: string
  description: string
}

export default function PlaceholderSurvey({ title, description }: PlaceholderSurveyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--color-muted-foreground)]">{description}</p>
    </div>
  )
}
