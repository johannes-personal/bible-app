import { lazy, Suspense } from 'react'
import App from './App'
import { useStudyRoute } from './route'

// Word study is a page of its own, loaded only when it's opened.
const WordStudy = lazy(() => import('./wordstudy/WordStudy'))

export default function Root() {
  const study = useStudyRoute()
  if (!study) return <App />
  return (
    <Suspense fallback={null}>
      <WordStudy route={study} />
    </Suspense>
  )
}
