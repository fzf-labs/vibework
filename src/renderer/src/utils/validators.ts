export const isValidPath = (path: string): boolean => {
  return path.trim().length > 0 && !path.includes('\0')
}

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export const isValidProjectName = (name: string): boolean => {
  return name.trim().length > 0 && name.length <= 100
}
