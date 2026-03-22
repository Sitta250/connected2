// Auto-generated types – reflects the Supabase schema.
// Run `supabase gen types typescript` to regenerate from your project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      universities: {
        Row: University
        Insert: Omit<University, "id" | "created_at">
        Update: Partial<Omit<University, "id">>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, "created_at" | "updated_at">
        Update: Partial<Omit<Profile, "id">>
      }
      courses: {
        Row: Course
        Insert: Omit<Course, "id" | "created_at">
        Update: Partial<Omit<Course, "id">>
      }
      course_reviews: {
        Row: CourseReview
        Insert: Omit<CourseReview, "id" | "created_at">
        Update: Partial<Omit<CourseReview, "id">>
      }
      course_questions: {
        Row: CourseQuestion
        Insert: Omit<CourseQuestion, "id" | "created_at">
        Update: Partial<Omit<CourseQuestion, "id">>
      }
      course_answers: {
        Row: CourseAnswer
        Insert: Omit<CourseAnswer, "id" | "created_at">
        Update: Partial<Omit<CourseAnswer, "id">>
      }
      course_resources: {
        Row: CourseResource
        Insert: Omit<CourseResource, "id" | "created_at">
        Update: Partial<Omit<CourseResource, "id">>
      }
      clubs: {
        Row: Club
        Insert: Omit<Club, "id" | "created_at">
        Update: Partial<Omit<Club, "id">>
      }
      club_members: {
        Row: ClubMember
        Insert: Omit<ClubMember, "id" | "joined_at">
        Update: Partial<Omit<ClubMember, "id">>
      }
      club_posts: {
        Row: ClubPost
        Insert: Omit<ClubPost, "id" | "created_at" | "like_count" | "comment_count">
        Update: Partial<Omit<ClubPost, "id">>
      }
      club_comments: {
        Row: ClubComment
        Insert: Omit<ClubComment, "id" | "created_at">
        Update: Partial<Omit<ClubComment, "id">>
      }
      marketplace_listings: {
        Row: MarketplaceListing
        Insert: Omit<MarketplaceListing, "id" | "created_at">
        Update: Partial<Omit<MarketplaceListing, "id">>
      }
      marketplace_messages: {
        Row: MarketplaceMessage
        Insert: Omit<MarketplaceMessage, "id" | "created_at">
        Update: Partial<Omit<MarketplaceMessage, "id">>
      }
      events: {
        Row: Event
        Insert: Omit<Event, "id" | "created_at" | "rsvp_count">
        Update: Partial<Omit<Event, "id">>
      }
      event_rsvps: {
        Row: EventRsvp
        Insert: Omit<EventRsvp, "id" | "created_at">
        Update: Partial<Omit<EventRsvp, "id">>
      }
      news_articles: {
        Row: NewsArticle
        Insert: Omit<NewsArticle, "id" | "created_at">
        Update: Partial<Omit<NewsArticle, "id">>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      year_of_study: "1" | "2" | "3" | "4" | "masters" | "phd"
      club_role: "member" | "officer" | "president"
      item_condition: "new" | "like_new" | "good" | "fair" | "poor"
      resource_type: "notes" | "past_exam" | "slides" | "other"
    }
  }
}

// ─── Domain types ────────────────────────────────────────────────────────────

export interface University {
  id: string
  name: string
  domain: string
  logo_url: string | null
  created_at: string
}

export type YearOfStudy = "1" | "2" | "3" | "4" | "masters" | "phd"

export interface Profile {
  id: string
  university_id: string | null
  university_email: string
  full_name: string
  faculty: string | null
  major: string | null
  year_of_study: YearOfStudy | null
  avatar_url: string | null
  onboarding_complete: boolean
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  university_id: string
  code: string
  title: string
  description: string | null
  department: string | null
  credits: number | null
  professor: string | null
  created_at: string
}

export interface CourseReview {
  id: string
  course_id: string
  user_id: string
  rating: number
  difficulty: number
  body: string
  grade: string | null
  semester: string | null
  would_recommend: boolean
  created_at: string
}

export interface CourseQuestion {
  id: string
  course_id: string
  user_id: string
  title: string
  body: string | null
  is_resolved: boolean
  created_at: string
}

export interface CourseAnswer {
  id: string
  question_id: string
  user_id: string
  body: string
  is_accepted: boolean
  created_at: string
}

export interface CourseResource {
  id: string
  course_id: string
  user_id: string
  title: string
  description: string | null
  file_url: string | null
  type: "notes" | "past_exam" | "slides" | "other"
  created_at: string
}

export interface Club {
  id: string
  university_id: string
  name: string
  description: string | null
  category: string | null
  logo_url: string | null
  cover_url: string | null
  member_count: number
  is_verified: boolean
  created_at: string
}

export interface ClubMember {
  id: string
  club_id: string
  user_id: string
  role: "member" | "officer" | "president"
  joined_at: string
}

export interface ClubPost {
  id: string
  club_id: string
  user_id: string
  title: string | null
  body: string
  like_count: number
  comment_count: number
  created_at: string
}

export interface ClubComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
}

export interface MarketplaceListing {
  id: string
  seller_id: string
  university_id: string
  title: string
  description: string | null
  price: number | null
  condition: "new" | "like_new" | "good" | "fair" | "poor" | null
  category: string | null
  images: string[]
  is_sold: boolean
  is_free: boolean
  created_at: string
}

export interface MarketplaceMessage {
  id: string
  listing_id: string
  sender_id: string
  receiver_id: string
  body: string
  is_read: boolean
  created_at: string
}

export interface Event {
  id: string
  university_id: string
  club_id: string | null
  creator_id: string | null
  title: string
  description: string | null
  location: string | null
  starts_at: string
  ends_at: string | null
  image_url: string | null
  category: string | null
  rsvp_count: number
  created_at: string
}

export interface EventRsvp {
  id: string
  event_id: string
  user_id: string
  created_at: string
}

export interface NewsArticle {
  id: string
  university_id: string
  author_id: string | null
  title: string
  body: string
  image_url: string | null
  category: string | null
  published_at: string
  created_at: string
}

// ─── Enriched / joined types ─────────────────────────────────────────────────

export type CourseReviewWithProfile = CourseReview & {
  profiles: Pick<Profile, "full_name" | "avatar_url" | "major" | "year_of_study">
}

export type CourseQuestionWithProfile = CourseQuestion & {
  profiles: Pick<Profile, "full_name" | "avatar_url">
  course_answers: (CourseAnswer & {
    profiles: Pick<Profile, "full_name" | "avatar_url">
  })[]
}

export type ClubPostWithProfile = ClubPost & {
  profiles: Pick<Profile, "full_name" | "avatar_url">
}

export type MarketplaceListingWithSeller = MarketplaceListing & {
  profiles: Pick<Profile, "full_name" | "avatar_url" | "university_id">
}

export type EventWithClub = Event & {
  clubs: Pick<Club, "name" | "logo_url"> | null
}
