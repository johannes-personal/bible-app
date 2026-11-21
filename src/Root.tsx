import { lazy, Suspense } from 'react'
import App from './App'
import { useInspireRoute, useStudyRoute } from './route'

// Word study and inspiration mode are pages of their own, loaded only when they're opened.
const WordStudy = lazy(() => import('./wordstudy/WordStudy'))
const Inspiration = lazy(() => import('./inspiration/Inspiration'))

export default function Root() {
  const study = useStudyRoute()
  const inspire = useInspireRoute()
  if (inspire) {
    return (
      <Suspense fallback={<div className="inspire-loading" />}>
        <Inspiration key={inspire.topic ?? ''} topic={inspire.topic} />
      </Suspense>
    )
  }
  if (!study) return <App />
  return (
    <Suspense fallback={null}>
      <WordStudy route={study} />
    </Suspense>
  )
}
