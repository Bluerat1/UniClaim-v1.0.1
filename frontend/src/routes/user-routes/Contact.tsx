import MobileNavText from "@/components/NavHeadComp";

const Contact = () => {
  return (
    <>
      <div>
        <MobileNavText
          title="Contact Us"
          description="Have questions or need help?"
        />

        <div className="hidden lg:flex items-center justify-between pt-4 mx-4 lg:mx-6">
          <h1>Contact Us</h1>
          <p className="text-sm text-gray-500">Have questions or need help?</p>
        </div>

        <div className="mx-6 mt-5 flex flex-col gap-8">
          <div className="flex flex-col md:flex-row gap-5 lg:gap-5">
            {/* Email */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <h1 className="text-brand font-semibold text-manrope text-base">
                Email address
              </h1>
              <h2 className="text-xl font-semibold">
                paulninosalaan75@gmail.com
              </h2>
              <p className="text-sm text-zinc-500">
                Have a detailed question? Send us an email
              </p>
            </div>
            {/* Phone Number */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <h1 className="text-brand font-semibold text-manrope text-base">
                Phone Number
              </h1>
              <h2 className="text-xl font-semibold">+123 456 7890</h2>
              <p className="text-sm text-zinc-500 w-full">
                Need immediate assistance? Give us a call anytime.
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-5 lg:gap-5">
            {/* Office Hours */}
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <h1 className="text-brand font-semibold text-manrope text-base">
                Office Hours
              </h1>
              <div className="">
                <h2 className="text-xl font-semibold">Mon - Fri 9am - 5pm</h2>
                <h2 className="text-xl font-semibold">
                  Located at Medical Building -First Floor
                </h2>
              </div>
              <p className="text-sm text-zinc-500">
                Our team is available to help you during these hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Contact;
