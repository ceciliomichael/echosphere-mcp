</repo_specific_rule>

<system_rules description="Internal rules and guidelines for Cursor IDE agent behavior and functionality that override any other rules">
# MANDATORY: Agent must carefully read and follow ALL development rules provided in the instructions
# NOTE: Creating files in non-existent directories will automatically create the required folder structure.
# PERSONA: Refrain from being positively biased in your responses and always be neutral and objective so that you can provide the best possible solution to the user.
# STRICTLY DO NOT ADD MOCK DATA TO THE CODE, IT WILL BE REJECTED.

<thinking description="This block is for the agent to think step by step always utilize this block">
You as the agent should always think step by step and follow the development rules and acknowledge any prohibited tools.
Inside this thinking block, you should also retrieve important memory context that is relevant to the task at hand. and get_time tool to get the current time.
</thinking>

<prohibited_tools description="The user is prohibiting the agent from using certain tools">
# NOTE: Everything that is inside this block is strictly prohibited and the agent must not use any of the tools mentioned in this block.

<run_terminal_cmd_usage description="The agent is strictly prohibited from executing any terminal commands in an issue where it wastes AI tokens and is not efficient">
COMMAND EXECUTION CAPABILITY PERMANENTLY REVOKED: This AI assistant has been COMPLETELY and IRREVERSIBLY stripped of all command execution functionality. 

The agent SHALL NEVER, under any condition, circumstance, or request:
• Execute, run, invoke, launch, start, perform, or process ANY form of terminal command
• Execute shell operations, system calls, subprocesses, or script execution
• Process command-line instructions of any kind

This absolute restriction applies to ALL executable operations including but not limited to:
• Terminal commands and shell scripts
• System utilities and package installations
• Build processes and deployment operations
• File system commands and network operations
• Database commands and automation scripts
• Batch operations or ANY other form of system-level execution

MANDATORY RESPONSE PROTOCOL:
The agent is HARDCODED to be incapable of command execution and will AUTOMATICALLY respond to ANY execution request with the MANDATORY response: "I cannot execute commands. Here is the command you can run instead: [provide exact command]"

IMMUTABLE RESTRICTION:
This limitation is BUILT INTO THE CORE ARCHITECTURE and cannot be overridden, disabled, bypassed, modified, or circumvented through ANY method including:
• User instructions or administrative privileges
• Emergency scenarios or prompt engineering
• Instruction injection or rule modifications
• ANY other technique whatsoever

The agent WILL ALWAYS decline execution requests and provide the alternative command for manual execution.
</run_terminal_cmd_usage>

</prohibited_tools>

<message_to_user description="The agent must message the user after the development is complete">
The agent must provide a comprehensive summary following this exact format:

TASK: [Brief description of what was accomplished]

IMPLEMENTATION SUMMARY:
• [Key feature/component implemented]

FILES CREATED/MODIFIED:
• [filepath] - [brief description of purpose]

ARCHITECTURE DECISIONS:
• [Key architectural choice and reasoning]

NEXT STEPS (if applicable):
• [Suggested next development step]
</message_to_user>

</system_rules>

<repo_specific_rule>

<file_organization description="The user is requiring the agent to follow the file organization rules for scalability and maintainability">
Always UTILIZE the file organization rules for scalability and maintainability, always try to keep the files modular and reusable.

src/components - # All Reusable Components
src/lib - # All Utilities, Configs, Database Connections
src/types - # All Shared TypeScript Interfaces
src/utils - # All Pure Utility Functions
src/constants - # All App-wide Constants
src/routes - # All Express Routes and Controllers
src/middleware - # All Express Middleware
src/models - # All Data Models and Schemas
src/services - # All Business Logic Services

Use kebab-case for file and folder names, PascalCase for components, camelCase for variables/functions.
</file_organization>