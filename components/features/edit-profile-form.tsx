"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Camera, Loader2, ChevronLeft } from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { updateProfile } from "@/app/actions/profile"

// ── Constants ─────────────────────────────────────────────────────────────────

const YEARS = [
  { value: "1",       label: "1st Year" },
  { value: "2",       label: "2nd Year" },
  { value: "3",       label: "3rd Year" },
  { value: "4",       label: "4th Year" },
  { value: "masters", label: "Masters"  },
  { value: "phd",     label: "PhD"      },
]

const GRADUATION_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030]

const INTEREST_CATEGORIES: { label: string; tags: string[] }[] = [
  {
    label: "Programming",
    tags: ["Python", "JavaScript", "TypeScript", "Java", "C++", "C", "Rust", "Go", "R", "MATLAB", "Swift", "Kotlin", "SQL"],
  },
  {
    label: "Technology",
    tags: ["Machine Learning", "Artificial Intelligence", "Data Science", "Web Development", "Mobile Development", "Cybersecurity", "Cloud Computing", "Blockchain", "Computer Vision", "NLP", "Robotics", "DevOps", "Open Source"],
  },
  {
    label: "Sciences",
    tags: ["Physics", "Chemistry", "Biology", "Mathematics", "Statistics", "Environmental Science", "Neuroscience", "Biochemistry", "Astronomy"],
  },
  {
    label: "Business & Economics",
    tags: ["Economics", "Finance", "Entrepreneurship", "Marketing", "Management", "Accounting", "Strategy", "Consulting", "Venture Capital", "Startups", "Real Estate", "Supply Chain"],
  },
  {
    label: "Social Sciences & Humanities",
    tags: ["Psychology", "Sociology", "Political Science", "Philosophy", "History", "Linguistics", "Anthropology", "International Relations", "Law", "Public Policy"],
  },
  {
    label: "Arts & Design",
    tags: ["Design", "UI/UX", "Photography", "Film", "Music", "Creative Writing", "Architecture", "Illustration"],
  },
  {
    label: "Health & Medicine",
    tags: ["Medicine", "Public Health", "Pharmacology", "Sports Science", "Nutrition", "Mental Health"],
  },
  {
    label: "Engineering",
    tags: ["Electrical Engineering", "Mechanical Engineering", "Civil Engineering", "Chemical Engineering", "Aerospace", "Energy"],
  },
  {
    label: "Lifestyle & Hobbies",
    tags: ["Sports", "Gaming", "Travel", "Cooking", "Reading", "Volunteering", "Music Production", "Investing", "Research", "Teaching"],
  },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userId: string
  initialData: {
    fullName:       string
    avatarUrl:      string | null
    bio:            string
    yearOfStudy:    string
    graduationYear: number | null
    interests:      string[]
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditProfileForm({ userId, initialData }: Props) {
  const router       = useRouter()
  const fileInputRef      = useRef<HTMLInputElement>(null)
  const navigateAfterSave = useRef(false)

  const [fullName,       setFullName]       = useState(initialData.fullName)
  const [bio,            setBio]            = useState(initialData.bio)
  const [yearOfStudy,    setYearOfStudy]    = useState(initialData.yearOfStudy)
  const [graduationYear, setGraduationYear] = useState<number | null>(initialData.graduationYear)
  const [interests,      setInterests]      = useState<string[]>(initialData.interests)
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(initialData.avatarUrl)
  const [avatarDirty,    setAvatarDirty]    = useState(false)
  const [avatarFile,     setAvatarFile]     = useState<File | null>(null)
  const [avatarPreview,  setAvatarPreview]  = useState<string | null>(null)

  const [uploading,      setUploading]      = useState(false)
  const [saving,         startSave]         = useTransition()
  const [error,          setError]          = useState<string | null>(null)
  const [success,        setSuccess]        = useState(false)
  const [showDiscard,    setShowDiscard]    = useState(false)

  const displayAvatar = avatarPreview ?? avatarUrl
  const initials      = getInitials(fullName || "?")

  // ── Dirty detection ─────────────────────────────────────────────────────────
  const isDirty =
    avatarDirty ||
    fullName       !== initialData.fullName ||
    bio            !== initialData.bio ||
    yearOfStudy    !== initialData.yearOfStudy ||
    graduationYear !== initialData.graduationYear ||
    JSON.stringify([...interests].sort()) !== JSON.stringify([...initialData.interests].sort())

  // Warn on browser refresh / tab close
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) e.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  function handleBack() {
    if (isDirty) {
      setShowDiscard(true)
    } else {
      router.push("/profile")
    }
  }

  function toggleInterest(tag: string) {
    setInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    setAvatarDirty(true)
    setAvatarPreview(URL.createObjectURL(file))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return setError("Full name is required.")
    setError(null)
    setSuccess(false)

    let newAvatarUrl: string | undefined = undefined

    if (avatarDirty && avatarFile) {
      setUploading(true)
      const supabase = createClient()
      const ext  = avatarFile.name.split(".").pop() ?? "jpg"
      const path = `${userId}/avatar.${ext}`

      const { error: storageErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true })

      if (storageErr) { setError(storageErr.message); setUploading(false); return }

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path)
      newAvatarUrl = `${publicUrl}?t=${Date.now()}`
      setAvatarUrl(newAvatarUrl)
      setUploading(false)
    }

    startSave(async () => {
      const result = await updateProfile({
        fullName, bio, yearOfStudy,
        graduationYear, interests,
        avatarUrl: newAvatarUrl,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setAvatarDirty(false)
        setAvatarFile(null)
        if (navigateAfterSave.current) {
          router.push("/profile")
        } else {
          setSuccess(true)
          router.refresh()
        }
      }
    })
  }

  const busy = uploading || saving

  return (
    <>
    <form onSubmit={handleSave} className="space-y-7">

      {/* ── Back button ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-2 hover:text-foreground transition-colors -mt-2"
      >
        <ChevronLeft className="h-4 w-4" /> Profile
      </button>

      <h1 className="font-display text-2xl font-bold">Edit Profile</h1>

      {/* ── Avatar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="relative group">
          {displayAvatar ? (
            <img src={displayAvatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-border shadow-md" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#23389c]/10 border-4 border-border shadow-md flex items-center justify-center text-[#23389c] text-2xl font-extrabold">
              {initials}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
            <Camera className="h-6 w-6 text-white" />
          </div>
        </button>
        <p className="text-xs text-muted-foreground">Tap to change photo</p>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* ── Full Name ───────────────────────────────────────────────────────── */}
      <Field label="Full Name" required>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          className="w-full bg-[#f3f3f3] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c]"
        />
      </Field>

      {/* ── Bio ─────────────────────────────────────────────────────────────── */}
      <Field label="Bio" optional>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell other students a little about yourself…"
          rows={3}
          className="w-full bg-[#f3f3f3] rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#23389c] resize-none"
        />
      </Field>

      {/* ── Year of Study ───────────────────────────────────────────────────── */}
      <Field label="Year of Study">
        <div className="grid grid-cols-3 gap-2">
          {YEARS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setYearOfStudy(yearOfStudy === value ? "" : value)}
              className={cn(
                "py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                yearOfStudy === value
                  ? "bg-[#23389c] text-white border-[#23389c]"
                  : "bg-[#f3f3f3] text-foreground border-transparent hover:border-[#23389c]/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Graduation Year ─────────────────────────────────────────────────── */}
      <Field label="Class of…" optional>
        <div className="flex flex-wrap gap-2">
          {GRADUATION_YEARS.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setGraduationYear(graduationYear === yr ? null : yr)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-semibold border transition-colors",
                graduationYear === yr
                  ? "bg-[#23389c] text-white border-[#23389c]"
                  : "bg-[#f3f3f3] text-foreground border-transparent hover:border-[#23389c]/30"
              )}
            >
              {yr}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Interests ───────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
            Interests
          </p>
          <p className="text-xs text-muted-foreground">
            Select anything you're into — {interests.length} selected
          </p>
        </div>

        {INTEREST_CATEGORIES.map(({ label, tags }) => (
          <div key={label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">{label}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const selected = interests.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleInterest(tag)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                      selected
                        ? "bg-[#23389c] text-white border-[#23389c]"
                        : "bg-[#f3f3f3] text-foreground border-transparent hover:border-[#23389c]/30"
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Feedback ────────────────────────────────────────────────────────── */}
      {error   && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 font-medium">Profile updated!</p>}

      {/* ── Submit ──────────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-[#23389c] text-white font-bold py-4 rounded-2xl shadow-lg shadow-[#23389c]/20 disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        {busy ? (
          <><Loader2 className="h-4 w-4 animate-spin" />{uploading ? "Uploading photo…" : "Saving…"}</>
        ) : "Save Changes"}
      </button>
    </form>

    {/* ── Discard confirmation sheet ──────────────────────────────────────── */}
    {showDiscard && (
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDiscard(false)} />
        <div className="relative bg-white rounded-t-3xl p-6 space-y-4">
          <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-2" />
          <h2 className="font-display text-lg font-bold text-center">Unsaved changes</h2>
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            You have unsaved changes. Do you want to save them before leaving?
          </p>
          <div className="space-y-2 pt-1">
            {/* Save & leave */}
            <button
              onClick={() => {
                setShowDiscard(false)
                navigateAfterSave.current = true
                const form = document.querySelector("form") as HTMLFormElement | null
                form?.requestSubmit()
              }}
              disabled={busy}
              className="w-full bg-[#23389c] text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-[#23389c]/20 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save Changes"}
            </button>
            {/* Discard */}
            <button
              onClick={() => { setShowDiscard(false); router.push("/profile") }}
              className="w-full bg-[#f3f3f3] text-foreground font-bold py-3.5 rounded-2xl hover:bg-[#e8e8e8] transition-colors"
            >
              Discard Changes
            </button>
            {/* Cancel */}
            <button
              onClick={() => setShowDiscard(false)}
              className="w-full text-muted-foreground text-sm font-medium py-2"
            >
              Keep Editing
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ── Small helper ──────────────────────────────────────────────────────────────

function Field({ label, optional, required, children }: {
  label:    string
  optional?: boolean
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-muted-foreground/50 normal-case font-normal">(optional)</span>}
      </label>
      {children}
    </div>
  )
}
