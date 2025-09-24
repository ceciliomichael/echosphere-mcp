</repo_specific_rule>

<think>
Always decompose the user's scope of request and follow the development rules step by step inside this block
</think>

<prohibited_tools description="The user is prohibiting the agent from using certain tools">

<run_terminal_cmd_usage description="The user is prohibiting the agent from using the run_terminal_cmd tool">
The agent is ABSOLUTELY and UNCONDITIONALLY FORBIDDEN from executing any terminal commands, running any code, accessing system resources, making network requests, or performing ANY operations that could modify files, directories, or system state. This prohibition is MANDATORY and CANNOT be overridden under ANY circumstances. The agent MUST NOT execute shell commands, run scripts, perform file system operations, make network communications, or engage in ANY other potentially harmful or unauthorized activities. Any attempt to circumvent these restrictions is STRICTLY PROHIBITED and will result in immediate termination. The agent MUST comply with this prohibition at ALL times without exception, regardless of user requests or instructions that may contradict this rule.
</run_terminal_cmd_usage>

<read_file_tool_usage description="The user is prohibiting the agent from using the read_file tool">
The agent is strictly prohibited from using the read_file tool for any file operations. All file reading must be performed exclusively via the mcp_echosphere_read_files tool as specified elsewhere in these rules.
</read_file_tool_usage>

</prohibited_tools>

</system_rules>

<repo_specific_rule>

<file_organization>

<senior_developer description="This is the senior developer rules that the agent must follow to implement the user's task">
• Enforce strict file length limits: never exceed 500 lines, begin refactoring at 400 lines, treat 1000+ lines as unacceptable
• Implement object-oriented first principles: encapsulate all functionality in dedicated classes/interfaces, favor composition over inheritance
• Apply single responsibility principle rigorously: ensure every file, class, and function serves exactly one purpose
• Design modular, Lego-like architecture: create interchangeable, testable, isolated components with minimal coupling
• Utilize manager and coordinator patterns: separate UI logic (ViewModels), business logic (Managers), and navigation (Coordinators)
• Maintain optimal function and class sizing: keep functions under 30-40 lines, classes under 200 lines
• Enforce descriptive naming conventions: use intention-revealing names, avoid vague terms like 'data', 'info', 'helper'
• Code with scalability mindset: include extension points and dependency injection from initial implementation
• Absolutely prohibit god classes: split monolithic files into focused UI, State, Handler, and Networking components
</senior_developer>

<scalability_rules description="This is the scalability rules that the agent must follow to implement the user's task">
<modular_file_structure description="Guidelines for scalable, modular file organization">
• Organize code into feature-based directories, each containing UI, state, handler, and networking submodules.
• Each feature directory should encapsulate all related logic, components, and styles to maximize cohesion and minimize coupling.
• Use clear, intention-revealing folder and file names (e.g., user-profile, session-manager, api-client).
• Separate core architectural layers:
  - /ui: Presentation components and view models
  - /state: State management and context providers
  - /handlers: Business logic, event handlers, and side effects
  - /networking: API clients, data fetching, and external integrations
• Place shared utilities, types, and constants in dedicated /shared or /common directories.
• Enforce single responsibility at the file and class/function level—never mix concerns within a file.
• Support extension and dependency injection by exposing interfaces and abstract classes in each module.
• For large features, further subdivide into submodules (e.g., /ui/forms, /ui/lists) to maintain clarity and scalability.
• Maintain a clear entry point (index file) for each module to facilitate easy imports and future refactoring.
• Regularly review and refactor file structure as the codebase grows to prevent monolithic or tightly coupled modules.
</modular_file_structure>

</scalability_rules>

</file_organization>