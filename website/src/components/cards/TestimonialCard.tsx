"use client";

import Image from "next/image";
import reviewsContent from "@/content/review.json";
import type { Mode } from "./shared-elements";

type ReviewContent = {
  reviews: Array<{
    id: string;
    name: string;
    subName: string;
    review: string;
    starCount: number;
    logoLocation: string;
    logoSize: {
      width: number;
      height: number;
    };
  }>;
};

export type TestimonialCardSpec = {
  root: {
    id: string;
  };
  name: string;
  subName: string;
  review: string;
  starCount: number;
  logo: {
    src: string;
    width: number;
    height: number;
  };
};

export const TESTIMONIAL_CARDS: TestimonialCardSpec[] = (reviewsContent as ReviewContent).reviews
  .slice(0, 3)
  .map((review) => ({
    root: { id: review.id },
    name: review.name,
    subName: review.subName,
    review: review.review,
    starCount: review.starCount,
    logo: {
      src: review.logoLocation,
      width: review.logoSize.width,
      height: review.logoSize.height,
    },
  }));

export function TestimonialCard({ mode, card }: { mode: Mode; card: TestimonialCardSpec }) {
  return (
    <article className={`tf-testimonial-card tf-testimonial-card--${mode}`} data-id={card.root.id} data-type="container">
      <div className="tf-testimonial-card-logo">
        <Image
          src={card.logo.src}
          alt={`${card.subName} logo`}
          width={card.logo.width}
          height={card.logo.height}
          unoptimized
        />
      </div>
      <p className="tf-testimonial-card-review">{card.review}</p>
      <div className="tf-testimonial-card-footer">
        <strong>{card.name}</strong>
        <span>{card.subName}</span>
        <span>{card.starCount}/5</span>
      </div>
    </article>
  );
}
