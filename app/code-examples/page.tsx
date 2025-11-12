"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"

export default function CodeExamplesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSidebarOpen = () => {
    setSidebarOpen(true)
  }

  const handleSidebarClose = () => {
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#191919] relative">
      {/* Header */}
      <Header onSidebarOpen={handleSidebarOpen} />
      
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />

      {/* Main Content */}
      <main className="pt-[150px] pb-20 px-4 sm:px-8 lg:px-[182.75px] max-w-[1440px] mx-auto">
        {/* Page Title */}
        <div className="mb-[80px]">
          <h1
            className="text-[40px] sm:text-[50px] lg:text-[70px] leading-[1.2] font-bold"
            style={{
              fontFamily: "var(--font-sohne), sans-serif",
              WebkitTextFillColor: "transparent",
              backgroundImage:
                "linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.1) 100%), linear-gradient(188.29deg, rgba(255, 255, 255, 1) 20.65%, rgba(247, 248, 255, 1) 47.15%, rgba(112, 132, 255, 1) 132.52%)",
              backgroundClip: "text",
            }}
          >
            Code Examples
          </h1>
        </div>

        {/* Accordion Sections */}
        <div className="w-full max-w-[937px] mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {/* LaunchDarkly Basics */}
            <AccordionItem value="basics" className="border-none">
              <AccordionTrigger className="py-[25.742px] px-0 hover:no-underline">
                <h2
                  className="text-[34.32px]  leading-[1.3] font-bold text-left flex-1"
                  style={{
                    fontFamily: "var(--font-sohne), sans-serif",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    backgroundClip: "text",
                  }}
                >
                  LaunchDarkly Basics
                </h2>
              </AccordionTrigger>
              <AccordionContent className="pt-[26px] pb-0">
                <div className="flex flex-col gap-[32px]">
                  {/* Import SDK */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      Import the appropriate SDK
                    </h3>
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`import * as ld from 'launchdarkly-node-server-sdk'`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Initialize SDK */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Initialize the SDK client
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        This pulls all the flag data from LaunchDarkly&apos;s edge-based{" "}
                        <a
                          href="https://launchdarkly.com/blog/flag-delivery-at-edge/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#7084FF] underline underline-offset-2 hover:opacity-80 transition-opacity"
                        >
                          Flag Delivery Network
                        </a>
                        . Initialization takes less than 200ms to complete.
                      </p>
                    </div>
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`const ldOptions = {
  // Marks "name" and "email" as private, so they are not sent to LaunchDarkly
  privateAttributeNames: ["name", "email"],
  // Set the logger level to debug for development
  logger: ld.basicLogger({ level: "debug" }),
  // Set the flush interval (ms) for batching events
  flushInterval: 2000,
  // (Optional) Proxy and custom endpoints can also be set here
  // baseUri: "https://app.launchdarkly.com",
  // streamUri: "https://stream.launchdarkly.com",
}

const client = ld.init('sdk-key-123abc', ldOptions);
await client.waitForInitialization();`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Create Context */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Create the context
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Contexts contain any data that you intend to use for targeting.
                      </p>
                    </div>
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`// Example LaunchDarkly context with multiple kinds for flexible targeting
const context = {
  kind: "multi",
  user: {
    key: "example-user-id",
    name: "Jane Doe",
    email: "jane.doe@example.com",
    country: "US",
    // Add other user attributes as needed for targeting
  },
  organization: {
    key: "org-456",
    name: "Example Corp",
    industry: "technology",
    // Add org-level properties for B2B or group-related targeting
  },
  device: {
    key: "device-abc",
    type: "mobile",
    os: "iOS",
    // Useful for device/browser-based targeting
  }
};
// This context allows you to combine data from users, organizations, and devices for targeting and experimentation.
`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Flag Variation Examples Dropdown */}
                  <div className="flex flex-col gap-4">
                    <h3
                      className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]"
                      style={{ fontFamily: "var(--font-sohne), sans-serif" }}
                    >
                      Flag Variation Usage Examples
                    </h3>
                    <Accordion type="single" collapsible className="w-full">
                      {/* Boolean Flag Example */}
                      <AccordionItem value="boolean-flag" className="border-none">
                        <AccordionTrigger className="py-2 px-0 hover:no-underline group">
                          <span className="text-[#A7A9AC] text-[16px] font-medium" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                            Boolean Flag
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-4">
                          <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                            <SyntaxHighlighter
                              language="javascript"
                              style={vscDarkPlus}
                              customStyle={{
                                backgroundColor: "#2C2C2C",
                                padding: "28px",
                                margin: 0,
                                fontSize: "20px",
                                lineHeight: "1.65",
                                fontFamily: "var(--font-sohne-mono), monospace",
                                borderRadius: "5px",
                              }}
                              codeTagProps={{
                                style: {
                                  fontFamily: "var(--font-sohne-mono), monospace",
                                },
                              }}
                            >
{`const boolValue = await client.variation('flag-key-123abc', context, false);

// let's use the flag - in this case it's a boolean
if (boolValue) {
  // run our new code when the flag is ON
}`}
                            </SyntaxHighlighter>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      {/* JSON Flag Example */}
                      <AccordionItem value="json-flag" className="border-none border-t border-[#414042]">
                        <AccordionTrigger className="py-2 px-0 hover:no-underline group">
                          <span className="text-[#A7A9AC] text-[16px] font-medium" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                            JSON Flag
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-4">
                          <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                            <SyntaxHighlighter
                              language="javascript"
                              style={vscDarkPlus}
                              customStyle={{
                                backgroundColor: "#2C2C2C",
                                padding: "28px",
                                margin: 0,
                                fontSize: "20px",
                                lineHeight: "1.65",
                                fontFamily: "var(--font-sohne-mono), monospace",
                                borderRadius: "5px",
                              }}
                              codeTagProps={{
                                style: {
                                  fontFamily: "var(--font-sohne-mono), monospace",
                                },
                              }}
                            >
{`const jsonValue = await client.variation('homepage-config', context, {
  title: "Default Title",
  showBanner: false,
  featuredProducts: []
});

// Use config properties anywhere in your app
console.log(jsonValue.title);
if (jsonValue.showBanner) {
  // Show a banner dynamically
}
`}
                            </SyntaxHighlighter>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      {/* String Flag Example */}
                      <AccordionItem value="string-flag" className="border-none border-t border-[#414042]">
                        <AccordionTrigger className="py-2 px-0 hover:no-underline group">
                          <span className="text-[#A7A9AC] text-[16px] font-medium" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                            String Flag
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0 pb-4">
                          <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                            <SyntaxHighlighter
                              language="javascript"
                              style={vscDarkPlus}
                              customStyle={{
                                backgroundColor: "#2C2C2C",
                                padding: "28px",
                                margin: 0,
                                fontSize: "20px",
                                lineHeight: "1.65",
                                fontFamily: "var(--font-sohne-mono), monospace",
                                borderRadius: "5px",
                              }}
                              codeTagProps={{
                                style: {
                                  fontFamily: "var(--font-sohne-mono), monospace",
                                },
                              }}
                            >
{`const theme = await client.variation('theme-color', context, 'default');

// Use the string value for dynamic theming
if (theme === 'dark') {
  applyDarkTheme();
} else {
  applyLightTheme();
}
`}
                            </SyntaxHighlighter>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#6D7171] mt-[26px]" />
              </AccordionContent>
            </AccordionItem>

            {/* Explore SDKs Section */}
            <AccordionItem value="explore-sdks" className="border-none border-t border-[#6D7171]">
              <AccordionTrigger className="py-[25.742px] px-0 hover:no-underline">
                <h2
                  className="text-[34.32px] leading-[1.3] font-bold text-left flex-1"
                  style={{
                    fontFamily: "var(--font-sohne), sans-serif",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    backgroundClip: "text",
                  }}
                >
                  Explore SDKs
                </h2>
              </AccordionTrigger>
              <AccordionContent className="pt-[26px] pb-8">
                <div className="flex flex-col gap-6">
                  <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                    Explore LaunchDarkly SDKs for different platforms and languages:
                  </p>
                  <div className="flex flex-col gap-4">
                    <a
                      href="https://docs.launchdarkly.com/sdk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#7084FF] text-[16px] underline underline-offset-2 hover:opacity-80 transition-opacity"
                      style={{ fontFamily: "var(--font-sohne), sans-serif" }}
                    >
                      LaunchDarkly SDK Documentation →
                    </a>
                    <a
                      href="https://docs.launchdarkly.com/sdk/server-side"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#7084FF] text-[16px] underline underline-offset-2 hover:opacity-80 transition-opacity"
                      style={{ fontFamily: "var(--font-sohne), sans-serif" }}
                    >
                      Server-Side SDKs →
                    </a>
                    <a
                      href="https://docs.launchdarkly.com/sdk/client-side"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#7084FF] text-[16px] underline underline-offset-2 hover:opacity-80 transition-opacity"
                      style={{ fontFamily: "var(--font-sohne), sans-serif" }}
                    >
                      Client-Side SDKs →
                    </a>
                  </div>
                </div>
                <div className="h-px bg-[#6D7171] mt-[26px]" />
              </AccordionContent>
            </AccordionItem>

            {/* LaunchDarkly in AWS Serverless */}
            <AccordionItem value="aws-serverless" className="border-none border-t border-[#6D7171]">
              <AccordionTrigger className="py-[25.742px] px-0 hover:no-underline">
                <h2
                  className="text-[34.32px] leading-[1.3] font-bold text-left flex-1"
                  style={{
                    fontFamily: "var(--font-sohne), sans-serif",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    backgroundClip: "text",
                  }}
                >
                  LaunchDarkly in AWS Serverless
                </h2>
              </AccordionTrigger>
              <AccordionContent className="pt-[26px] pb-0">
                <div className="flex flex-col gap-[32px]">
                  {/* Using LaunchDarkly in Lambda */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Using LaunchDarkly in Lambda
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Choose the appropriate SDK (ex. Node)
                      </p>
                    </div>
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`const LaunchDarkly = require('launchdarkly-node-server-sdk')
const client = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY)

await client.waitForInitialization();
const flagValue = await client.variation("my-flag", { kind: "user", key: "anonymous" });`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Caching data in a data store */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Caching data in a data store
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        This example uses the Node runtime.
                      </p>
                    </div>
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`const LaunchDarkly = require("launchdarkly-node-server-sdk");
// The SDK add-on for DynamoDB support
const {
  DynamoDBFeatureStore,
} = require("launchdarkly-node-server-sdk-dynamodb");

const store = DynamoDBFeatureStore(process.env.DYNAMODB_TABLE);
// useLdd launches the client in daemon mode where flag values come
// from the data store (i.e. dynamodb)
const options = {
  featureStore: store,
  useLdd: true,
};
const client = LaunchDarkly.init(process.env.LAUNCHDARKLY_SDK_KEY, options);`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Recording LaunchDarkly events */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Recording LaunchDarkly events
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Flush events and close the client on Lambda shutdown.
                      </p>
                    </div>
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`process.on('SIGTERM', async () => {
  console.info('[runtime] SIGTERM received');

  console.info('[runtime] cleaning up');
  // flush is currently required for the Node SDK
  await client.flush()
  client.close();
  console.info('LaunchDarkly connection closed');
  
  console.info('[runtime] exiting');
  process.exit(0)
});`}
                      </SyntaxHighlighter>
                    </div>
                    <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      Learn more about using {" "}
                      <a
                        href="https://launchdarkly.com/blog/using-launchdarkly-in-aws-serverless/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7084FF] underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        LaunchDarkly in AWS Serverless
                      </a>
                      !
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#6D7171] mt-[26px]" />
              </AccordionContent>
            </AccordionItem>

            {/* Mobile Targeting */}
            <AccordionItem value="mobile-targeting" className="border-none border-t border-[#6D7171]">
              <AccordionTrigger className="py-[25.742px] px-0 hover:no-underline">
                <h2
                  className="text-[34.32px] leading-[1.3] font-bold text-left flex-1"
                  style={{
                    fontFamily: "var(--font-sohne), sans-serif",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    backgroundClip: "text",
                  }}
                >
                  Mobile Targeting
                </h2>
              </AccordionTrigger>
              <AccordionContent className="pt-[26px] pb-0">
                <div className="flex flex-col gap-[32px]">
                  {/* Overview */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Automatic Environment Attributes
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        LaunchDarkly mobile SDKs automatically provide data about the environment where the application is running. This data makes it simpler to target your mobile customers based on application name or version, or on device characteristics including manufacturer, model, operating system, locale, and more.
                      </p>
                    </div>
                  </div>

                  {/* Environment Attributes Table */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      Environment Attributes Reference
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[#6D7171]">
                            <th className="text-left py-3 px-4 text-[#D1D3D4] text-[16px] font-bold" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Context Kind
                            </th>
                            <th className="text-left py-3 px-4 text-[#D1D3D4] text-[16px] font-bold" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Attribute
                            </th>
                            <th className="text-left py-3 px-4 text-[#D1D3D4] text-[16px] font-bold" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Description
                            </th>
                            <th className="text-left py-3 px-4 text-[#D1D3D4] text-[16px] font-bold" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Examples
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* ld_application attributes */}
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal align-top" style={{ fontFamily: "var(--font-sohne-mono), monospace" }} rowSpan={6}>
                              ld_application
                            </td>
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              key
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Unique for this context kind. Automatically generated by the SDK.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              randomly generated
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              id
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Unique identifier of the application.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              com.launchdarkly.example
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              locale
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Locale of the device, in IETF BCP 47 Language Tag format.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              en-US
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              name
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Human-friendly name of the application.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              Example Mobile App
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              version
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Version of the application used for update comparison.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              5, 1.2.3
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              versionName
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Human-friendly name of the version. May or may not be a semantic version.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              5, 1.2
                            </td>
                          </tr>
                          
                          {/* ld_device attributes */}
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal align-top" style={{ fontFamily: "var(--font-sohne-mono), monospace" }} rowSpan={9}>
                              ld_device
                            </td>
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              key
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Unique for this context kind. Automatically generated by the SDK.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              randomly generated
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              manufacturer
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Manufacturer of the device.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              Apple, Samsung
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              model
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Model of the device.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              iPhone 14, Galaxy S23
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              os/family
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Operating system family.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              iOS, Android
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              os/name
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Operating system name.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              iOS, Android
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              os/version
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Operating system version.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              16.0, 13
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              type
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Type of device (mobile, tablet, etc.).
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              mobile, tablet
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              screenWidth
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Screen width in pixels.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              390, 428
                            </td>
                          </tr>
                          <tr className="border-b border-[#414042]">
                            <td className="py-3 px-4 text-[#7084FF] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              screenHeight
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                              Screen height in pixels.
                            </td>
                            <td className="py-3 px-4 text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne-mono), monospace" }}>
                              844, 926
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Reference link */}
                  <div className="flex flex-col gap-4">
                    <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      To learn more about mobile targeting, including how to create targeting rules based on these attributes, read{" "}
                      <a
                        href="https://launchdarkly.com/docs/home/flags/mobile-targeting"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7084FF] underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        Mobile targeting
                      </a>
                      .
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-[#6D7171] mt-[26px]" />
              </AccordionContent>
            </AccordionItem>

            {/* Experimentation */}
            <AccordionItem value="experimentation" className="border-none border-t border-[#6D7171]">
              <AccordionTrigger className="py-[25.742px] px-0 hover:no-underline">
                <h2
                  className="text-[34.32px] leading-[1.3] font-bold text-left flex-1"
                  style={{
                    fontFamily: "var(--font-sohne), sans-serif",
                    WebkitTextFillColor: "transparent",
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%), linear-gradient(90deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 100%)",
                    backgroundClip: "text",
                  }}
                >
                  Experimentation
                </h2>
              </AccordionTrigger>
              <AccordionContent className="pt-[26px] pb-0">
                <div className="flex flex-col gap-[32px]">
                  {/* Overview */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        About Experimentation
                      </h3>
                      <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                        Experimentation lets you validate the impact of features you roll out to your app or infrastructure. You can measure things like page views, clicks, load time, infrastructure costs, and more. By connecting metrics you create to flags or AI Configs in your LaunchDarkly environment, you can measure the changes in your customer&apos;s behavior based on the different variations your application serves. This helps you make more informed decisions, so the features your development team ships align with your business objectives.
                      </p>
                    </div>
                  </div>

                  {/* Track Custom Events */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      Track Custom Events for Experimentation
                    </h3>
                    <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      Use the track method to record custom events that can be measured in your experiments. Custom events help you measure user behavior and conversion rates based on flag variations.
                    </p>
                    
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`// Track a simple custom event
client.track('something-happened');`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Track Custom Events with Data */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-[#D1D3D4] text-[18px] font-bold leading-[1.4]" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      Track Events with Custom Data
                    </h3>
                    <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      You can also track events with additional custom data that provides more context for your experiments.
                    </p>
                    
                    <div className="bg-[#2C2C2C] rounded-[5px] overflow-hidden">
                      <SyntaxHighlighter
                        language="javascript"
                        style={vscDarkPlus}
                        customStyle={{
                          backgroundColor: "#2C2C2C",
                          padding: "28px",
                          margin: 0,
                          fontSize: "20px",
                          lineHeight: "1.65",
                          fontFamily: "var(--font-sohne-mono), monospace",
                          borderRadius: "5px",
                        }}
                        codeTagProps={{
                          style: {
                            fontFamily: "var(--font-sohne-mono), monospace",
                          },
                        }}
                      >
                        {`// Track an event with custom data
client.track('something-happened-with-custom-data', { someData: 2 });`}
                      </SyntaxHighlighter>
                    </div>
                  </div>

                  {/* Reference link */}
                  <div className="flex flex-col gap-4">
                    <p className="text-[#D1D3D4] text-[16px] leading-normal" style={{ fontFamily: "var(--font-sohne), sans-serif" }}>
                      To learn more about experimentation, including how to create experiments, analyze results, and best practices, read{" "}
                      <a
                        href="https://launchdarkly.com/docs/home/experimentation"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#7084FF] underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        Experimentation
                      </a>
                      .
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </div>
  )
}

