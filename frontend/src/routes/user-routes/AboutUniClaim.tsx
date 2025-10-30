// components
import MobileNavText from "@/components/layout/NavHead";

// icons
import { IoChatbubblesOutline } from "react-icons/io5";
import { TbFilterSearch } from "react-icons/tb";
import { GrUserAdmin } from "react-icons/gr";
import { HiOutlineBellAlert } from "react-icons/hi2";
import { IoIosArrowRoundForward } from "react-icons/io";

// images
import Logo from "../../assets/uniclaim_logo.png";
import UserSurvey from "../../assets/user_sruvey.png";
import USTPImg from "../../assets/ustp.jpg";
import Montano from "../../assets/montano.jpg";
import Salaan from "../../assets/salaan.png";
import Camaro from "../../assets/camaro.png";
import Delez from "../../assets/delez.png";
import Amolato from "../../assets/amolato.png";

const AboutUniClaim = () => {
  return (
    <>
      <div className="mb-13">
        <MobileNavText
          title="About UniClaim"
          description="Get to know us more"
        />

        <div className="mx-4 lg:mx-6 hidden lg:flex items-center justify-between pt-4">
          <h1 className="font-albert-sans font-medium text-base text-blue-950">
            About UniClaim
          </h1>
          <p className="text-sm text-gray-500">Get to know us more</p>
        </div>

        {/* image banner container */}
        <div className="relative h-65 w-full px-2 md:h-90 lg:h-120 lg:px-6 lg:mt-4">
          {/* Background Image Layer */}
          <div className="absolute inset-0 bg-[url('@/assets/aboutuniclaim.jpg')] bg-cover bg-center" />

          {/* Dark Overlay Layer */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />

          {/* Foreground Content */}
          <div className="relative z-10 h-full flex items-center justify-center">
            <div className="flex flex-col items-center justify-center text-center space-y-1.5 lg:space-y-2">
              <div className="flex items-center justify-center gap-1">
                <img
                  src={Logo}
                  alt="image_logo"
                  className="size-12 md:size-15 lg:size-17"
                />
                <h1 className="text-white font-albert-sans font-semibold text-3xl md:text-4xl lg:text-5xl">
                  <span className="text-brand">Uni</span>Claim
                </h1>
              </div>
              <p className="font-medium text-white text-sm w-[20rem] md:text-lg md:w-[30rem] lg:text-xl">
                A Lost and Found System for USTP-CDO Campus with Advanced Search
                Filter and User Verification
              </p>
            </div>
          </div>
        </div>

        <div className="mx-4 lg:mx-6">
          {/* for taking the survey and download the app section */}
          <div className="grid grid-cols-1 gap-4 mt-7 md:grid-cols-2">
            <div className="bg-navyblue p-3 rounded-md h-auto">
              <div className="flex flex-row gap-4">
                <div className="shrink-0">
                  <img
                    src={UserSurvey}
                    alt="userSurvey"
                    className="size-30 rounded-md"
                  />
                </div>
                <div className="flex flex-col justify-center space-y-1">
                  <h1 className="font-bold font-manrope text-sm text-brand">
                    Take Our Survey
                  </h1>
                  <p className="text-xs font-inter text-white">
                    Please tell us what you think about our system by scanning
                    the QR code or clicking the button to take the survey. Your
                    feedback is highly appreciated!
                  </p>
                  <div className="w-full hidden lg:flex items-center justify-center mt-4 max-w-[200px]">
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSdcKHISn8yHb-muHPqEzJkDS4bflXdZm98Mf6T6BWZvVl8xkg/viewform"
                      target="_blank"
                      className="text-navyblue bg-brand hover:bg-yellow-600 w-full text-sm py-1.5 text-center rounded-sm"
                    >
                      Take Now
                    </a>
                  </div>
                </div>
              </div>
              <div className="w-full lg:hidden flex items-center justify-center mt-4">
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdcKHISn8yHb-muHPqEzJkDS4bflXdZm98Mf6T6BWZvVl8xkg/viewform"
                  target="_blank"
                  className="text-navyblue bg-brand hover:bg-yellow-600 w-full text-sm py-1.5 text-center rounded-sm"
                >
                  Take Now
                </a>
              </div>
            </div>
            <div className="bg-navyblue p-3 rounded-md h-auto">
              <div className="flex flex-row gap-4">
                <div className="shrink-0">
                  <div className="bg-white size-30 rounded-md flex justify-center items-center px-5">
                    <p className="text-black text-center text-sm">
                      Soon to be posted
                    </p>
                  </div>
                </div>
                <div className="flex flex-col justify-center space-y-1">
                  <h1 className="font-bold font-manrope text-sm text-brand">
                    Download our App
                  </h1>
                  <p className="text-xs font-inter text-white">
                    Download the UniClaim mobile app for a faster and more
                    convenient lost-and-found experience. Report items, receive
                    updates, and stay informed on the go.
                  </p>
                  <div className="w-full hidden lg:flex items-center justify-center mt-4 max-w-[200px]">
                    <a
                      href="https://docs.google.com/forms/d/e/1FAIpQLSdcKHISn8yHb-muHPqEzJkDS4bflXdZm98Mf6T6BWZvVl8xkg/viewform"
                      target="_blank"
                      className="text-navyblue bg-brand hover:bg-yellow-600 w-full text-sm py-1.5 text-center rounded-sm"
                    >
                      Click to Download
                    </a>
                  </div>
                </div>
              </div>
              <div className="w-full lg:hidden flex items-center justify-center mt-4">
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSdcKHISn8yHb-muHPqEzJkDS4bflXdZm98Mf6T6BWZvVl8xkg/viewform"
                  target="_blank"
                  className="text-navyblue bg-brand hover:bg-yellow-600 w-full text-sm py-1.5 text-center rounded-sm"
                >
                  Click to Download
                </a>
              </div>
            </div>
          </div>
          {/* image with info text */}
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-8 lg:my-10">
            <img
              src={USTPImg}
              alt="ustpimage"
              className="hidden w-full h-full rounded lg:w-full lg:h-auto lg:block"
            />
            <div className="">
              <h1 className="text-brand mt-5 mb-3 font-semibold text-base lg:text-xl lg:mt-0">
                About UniClaim
              </h1>
              <div className="space-y-3 mb-8">
                <p className="text-sm font-inter leading-5.5 lg:text-base lg:leading-7">
                  UniClaim is a cross-platform lost and found system in USTP-CDO
                  campus designed to help students and staff report, track, and
                  retrieve lost and found items on campus. Our system allows
                  users to securely log in and report any lost or found items,
                  making it easier for the rightful owners to be reunited with
                  their belongings. With real-time notifications, users are
                  quickly alerted whenever a match for their lost or found item
                  is made.
                </p>
                <p className="text-sm font-inter leading-5.5 lg:text-base lg:leading-7">
                  Administrators can efficiently manage reports, ensuring that
                  all cases are handled smoothly. Our goal is to create a
                  seamless and convenient experience for the campus community,
                  helping lost items find their way back to their owners in a
                  secure and timely manner.
                </p>
              </div>
            </div>
          </div>

          {/* key-features section */}
          <div className="mt-10 mb-20">
            <h1 className="text-base md:text-lg lg:text-xl font-semibold mb-5">
              Key Features
            </h1>
            {/* features section */}
            <div className="grid grid-cols-1 gap-5 lg:gap-5 lg:grid-cols-4 ">
              {/* real time messaging feature */}
              <div className="relative bg-[url('https://images.pexels.com/photos/5838215/pexels-photo-5838215.jpeg?_gl=1*122gi4p*_ga*Mzg2NzU3Mzk1LjE3MzQ2OTIwNjI.*_ga_8JE65Q40S6*czE3NTM5MzMzMTQkbzYwJGcxJHQxNzUzOTMzMzM3JGozNyRsMCRoMA..')] bg-cover bg-center w-full rounded h-95">
                <div className="absolute inset-0"></div>
                {/* dark-overlay layer */}
                <div className="absolute inset-0 bg-black/20 rounded" />
                {/* image content container*/}
                <div className="absolute inset-x-0 bottom-0 px-4 pb-5 z-10">
                  <IoChatbubblesOutline className="size-15 lg:size-12 mb-4 text-white stroke-[1.5px]" />
                  <h1 className="text-white font-medium text-lg mb-1">
                    Real Time Messaging
                  </h1>
                  <p className="text-white text-sm lg:text-xs leading-4 mb-4">
                    Instantly connect and communicate with users through smooth,
                    live messaging across the platform.
                  </p>
                  <div className="flex justify-end">
                    <div className="items-center inline-flex gap-2 text-sm font-medium text-white hover:text-zinc-300 transition-colors duration-300">
                      <a href="#" className="font-light text-xs">
                        Read More
                      </a>
                      <IoIosArrowRoundForward className="size-4 stroke-[1.5px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* advanced search filter feature */}
              <div className="relative bg-[url('https://images.pexels.com/photos/3769697/pexels-photo-3769697.jpeg?_gl=1*1l7es6h*_ga*Mzg2NzU3Mzk1LjE3MzQ2OTIwNjI.*_ga_8JE65Q40S6*czE3NTM5MzYxMDIkbzYxJGcxJHQxNzUzOTM2MTE1JGo0NyRsMCRoMA..')] bg-cover bg-center w-full rounded h-95">
                <div className="absolute inset-0"></div>
                {/* dark-overlay layer */}
                <div className="absolute inset-0 bg-black/20 rounded" />
                {/* image content container*/}
                <div className="absolute inset-x-0 bottom-0 px-4 pb-5 z-10">
                  <TbFilterSearch className="size-15 lg:size-12 mb-4 text-white stroke-[1.5px]" />
                  <h1 className="text-white font-medium text-lg mb-1">
                    Advanced Search Filter
                  </h1>
                  <p className="text-white text-sm lg:text-xs leading-4 mb-4">
                    Search lost or found items using filters like category and
                    location for more accurate search results.
                  </p>
                  <div className="flex justify-end">
                    <div className="items-center inline-flex gap-2 text-sm font-medium text-white hover:text-zinc-300 transition-colors duration-300">
                      <a href="#" className="font-light text-xs">
                        Read More
                      </a>
                      <IoIosArrowRoundForward className="size-4 stroke-[1.5px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* dedicated admin tool feature */}
              <div className="relative bg-[url('https://images.pexels.com/photos/3783879/pexels-photo-3783879.jpeg?_gl=1*15z3r3q*_ga*Mzg2NzU3Mzk1LjE3MzQ2OTIwNjI.*_ga_8JE65Q40S6*czE3NTM5MzYxMDIkbzYxJGcxJHQxNzUzOTM2MTM5JGoyMyRsMCRoMA..')] bg-cover bg-center w-full rounded h-95">
                <div className="absolute inset-0"></div>
                {/* dark-overlay layer */}
                <div className="absolute inset-0 bg-black/20 rounded" />
                {/* image content container*/}
                <div className="absolute inset-x-0 bottom-0 px-4 pb-5 z-10">
                  <GrUserAdmin className="size-15 lg:size-12 mb-4 text-white ml-2.5" />
                  <h1 className="text-white font-medium text-lg mb-1">
                    Dedicated Admin Tools
                  </h1>
                  <p className="text-white text-sm lg:text-xs leading-4 mb-4">
                    Simplify platform management with admin tools designed to
                    efficiently handle users and posts.
                  </p>
                  <div className="flex justify-end">
                    <div className="items-center inline-flex gap-2 text-sm font-medium text-white hover:text-zinc-300 transition-colors duration-300">
                      <a href="#" className="font-light text-xs">
                        Read More
                      </a>
                      <IoIosArrowRoundForward className="size-4 stroke-[1.5px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* real time notification feature */}
              <div className="relative bg-[url('https://images.pexels.com/photos/6863261/pexels-photo-6863261.jpeg?_gl=1*wg85pc*_ga*Mzg2NzU3Mzk1LjE3MzQ2OTIwNjI.*_ga_8JE65Q40S6*czE3NTM5MzYxMDIkbzYxJGcxJHQxNzUzOTM2MTcyJGo1OSRsMCRoMA..')] bg-cover bg-center w-full rounded h-95">
                <div className="absolute inset-0"></div>
                {/* dark-overlay layer */}
                <div className="absolute inset-0 bg-black/20 rounded" />
                {/* image content container*/}
                <div className="absolute inset-x-0 bottom-0 px-4 pb-5 z-10">
                  <HiOutlineBellAlert className="size-15 lg:size-12 mb-4 text-white" />
                  <h1 className="text-white font-medium text-lg mb-1">
                    Real-Time Notification
                  </h1>
                  <p className="text-white text-sm lg:text-xs leading-4 mb-4">
                    Stay informed with instant alerts for messages and item
                    updates so you never miss what matters.
                  </p>
                  <div className="flex justify-end">
                    <div className="items-center inline-flex gap-2 text-sm font-medium text-white hover:text-zinc-300 transition-colors duration-300">
                      <a href="#" className="font-light text-xs">
                        Read More
                      </a>
                      <IoIosArrowRoundForward className="size-4 stroke-[1.5px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* meet the team section */}
          <div className="">
            <h1 className="text-lg md:text-xl lg:text-2xl font-semibold text-center mb-10">
              Meet the UniClaim Team
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-9 md:gap-5 lg:gap-5">
              {/* Paul Salaan */}
              <div className="flex flex-col items-center w-full h-auto p-3">
                <img
                  src={Salaan}
                  alt="salaan"
                  className="rounded-full size-40 border border-black/10"
                />
                <div className="flex flex-col items-center mt-5 space-y-1">
                  <h1 className="text-brand text-lg font-medium font-manrope">
                    Paul Niño Salaan
                  </h1>
                  <p className="text-sm">System Analyst</p>
                  <a
                    href="mailto:yourname@gmail.com"
                    className="text-sm lg:text-xs text-blue-800 hover:underline mt-1 transition-all duration-300"
                  >
                    paulninosalaan75@gmail.com
                  </a>
                </div>
              </div>

              {/* Dave Camaro */}
              <div className="flex flex-col items-center w-full h-auto p-3">
                <img
                  src={Camaro}
                  alt="camaro"
                  className="rounded-full size-40 border border-black/10"
                />
                <div className="flex flex-col items-center mt-5 space-y-1">
                  <h1 className="text-brand text-lg font-medium font-manrope">
                    Dave Camaro
                  </h1>
                  <p className="text-sm">Frontend Developer</p>
                  <a
                    href="mailto:yourname@gmail.com"
                    className="text-sm lg:text-xs text-blue-800 hover:underline mt-1 transition-all duration-300"
                  >
                    dave.camaro03@gmail.com
                  </a>
                </div>
              </div>

              {/* Chamberlain Delez */}
              <div className="flex flex-col items-center w-full h-auto p-3">
                <img
                  src={Delez}
                  alt="delez"
                  className="rounded-full size-40 border border-black/10"
                />
                <div className="flex flex-col items-center mt-5 space-y-1">
                  <h1 className="text-brand text-lg font-medium font-manrope">
                    Chamberlain Delez
                  </h1>
                  <p className="text-sm">Backend Developer</p>
                  <a
                    href="mailto:yourname@gmail.com"
                    className="text-sm lg:text-xs text-blue-800 hover:underline mt-1 transition-all duration-300"
                  >
                    delez.chamberlain@gmail.com
                  </a>
                </div>
              </div>

              {/* Prince Laurence Montano*/}
              <div className="flex flex-col items-center w-full h-auto p-3">
                <img
                  src={Montano}
                  alt="montano"
                  className="rounded-full size-40 border border-black/10"
                />
                <div className="flex flex-col items-center mt-5 space-y-1">
                  <h1 className="text-brand text-lg font-medium font-manrope">
                    Prince Laurence Montano
                  </h1>
                  <p className="text-sm">Database Administrator</p>
                  <a
                    href="mailto:yourname@gmail.com"
                    className="text-sm lg:text-xs text-blue-800 hover:underline mt-1 transition-all duration-300"
                  >
                    montano.princelaurence29@gmail.com
                  </a>
                </div>
              </div>

              {/* Justine Amolato */}
              <div className="flex flex-col items-center w-full h-auto p-3">
                <img
                  src={Amolato}
                  alt="amolato"
                  className="rounded-full size-40 border border-black/10"
                />
                <div className="flex flex-col items-center mt-5 space-y-1">
                  <h1 className="text-brand text-lg font-medium font-manrope">
                    Justine Amolato
                  </h1>
                  <p className="text-sm">Writer/Researcher</p>
                  <a
                    href="mailto:yourname@gmail.com"
                    className="text-sm lg:text-xs text-blue-800 hover:underline mt-1 transition-all duration-300"
                  >
                    justineamolato75@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AboutUniClaim;
