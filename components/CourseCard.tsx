import BuyButton from '@/components/BuyButton'

type Course = {
  id: string
  title: string
  description: string | null
  price_paise: number
}

export default function CourseCard({
  course,
  number,
}: {
  course: Course
  number: number
}) {
  return (
    <div className="border border-[#e0dedc] bg-white p-6 transition hover:border-[#0a0a0a]">

      <div className="mb-4 flex h-12 w-12 items-center justify-center bg-[#e9e8e7]">
        <span className="text-sm text-[#535250]">
          {String(number).padStart(2, '0')}
        </span>
      </div>

      <h4 className="font-medium text-[#0a0a0a]">
        {course.title}
      </h4>

      <p className="mt-2 text-sm text-[#535250]">
        {course.description}
      </p>

      <p className="mt-4 text-lg font-medium text-[#0a0a0a]">
        ₹{(course.price_paise / 100).toLocaleString('en-IN')}
      </p>

      <div className="mt-5">
        <BuyButton
          courseId={course.id}
          title={course.title}
        />
      </div>

    </div>
  )
}