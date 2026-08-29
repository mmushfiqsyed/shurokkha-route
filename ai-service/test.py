from crewai import LLM

llm = LLM(model="gemini/gemini-3.5-flash")

response = llm.call("Say hello in exactly five words.")

print("RESPONSE:")
print(response)