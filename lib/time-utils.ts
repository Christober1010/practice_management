export function formatTime12hFromUTC(utcDateTimeString: string, userCurrentTimezone = "UTC"): string {
  if (!utcDateTimeString) return ""
  try {
    // Handle MySQL datetime format: "2025-10-02 03:30:00"
    // Convert to ISO format that JavaScript can parse
    let isoString = utcDateTimeString
    if (!isoString.includes("T")) {
      isoString = utcDateTimeString.replace(" ", "T")
    }
    if (!isoString.endsWith("Z")) {
      isoString += "Z"
    }

    const utcDate = new Date(isoString)
    if (isNaN(utcDate.getTime())) {
      console.error("[v0] Invalid date:", utcDateTimeString)
      return ""
    }

    const options: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: userCurrentTimezone,
    }
    return utcDate.toLocaleTimeString("en-US", options)
  } catch (error) {
    console.error("[v0] Error formatting time:", error, utcDateTimeString)
    return ""
  }
}

export function formatDateFromUTC(utcDateTimeString: string, userCurrentTimezone = "UTC"): string {
  if (!utcDateTimeString) return ""
  try {
    let isoString = utcDateTimeString
    if (!isoString.includes("T")) {
      isoString = utcDateTimeString.replace(" ", "T")
    }
    if (!isoString.endsWith("Z")) {
      isoString += "Z"
    }

    const utcDate = new Date(isoString)
    if (isNaN(utcDate.getTime())) {
      return ""
    }

    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: userCurrentTimezone,
    }
    return utcDate.toLocaleDateString("en-US", options)
  } catch (error) {
    console.error("[v0] Error formatting date:", error, utcDateTimeString)
    return ""
  }
}

export function toMinutes12h(t: string): number {
  if (!t || t === "—") return 24 * 60
  try {
    const parts = t.trim().split(" ")
    if (parts.length < 2) return 24 * 60

    const time = parts[0]
    const ampm = parts[1]
    const [hours, minutes] = time.split(":").map(Number)

    if (isNaN(hours) || isNaN(minutes)) {
      console.error("[v0] Invalid time format:", t)
      return 24 * 60
    }

    let hour = hours
    if (ampm.toUpperCase() === "AM") {
      if (hours === 12) hour = 0 // 12 AM = midnight = 0 minutes
    } else if (ampm.toUpperCase() === "PM") {
      if (hours !== 12) hour = hours + 12 // 1 PM = 13, 2 PM = 14, etc.
      // 12 PM stays as 12
    }

    const result = hour * 60 + minutes
    return result
  } catch (error) {
    console.error("[v0] Error in toMinutes12h:", error, t)
    return 24 * 60
  }
}
