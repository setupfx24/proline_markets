cmake_minimum_required(VERSION 3.21)
project(ProlineMarketsTerminal VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_INCLUDE_CURRENT_DIR ON)

# Official Qt (MSVC) with WebEngine for the embedded TradingView charts.
# Svg: the header/panel icons are rendered from SVG path data via QSvgRenderer
# so they stay sharp on scaled displays and take the theme colour.
find_package(Qt6 REQUIRED COMPONENTS Widgets Network WebSockets WebEngineWidgets WebChannel Svg)

if (APPLE AND TARGET WrapOpenGL::WrapOpenGL)
    # Drop AGL from the link line, or the build dies at the very last step with
    #     ld: framework 'AGL' not found
    # after every object has compiled cleanly.
    #
    # AGL is Apple's Carbon-era OpenGL API. It is gone from the macOS SDK, but
    # /System/Library/Frameworks/AGL.framework is still present on disk as an
    # empty husk — Resources, a _CodeSignature and a symlink pointing at a
    # binary that no longer exists, because the code now lives only in the dyld
    # shared cache.
    #
    # That husk is the trap. Qt's FindWrapOpenGL.cmake looks the framework up
    # with find_library(), which searches the system framework directories and
    # not just the sysroot, so it FINDS the empty bundle and records its
    # absolute path. CMake turns an absolute .framework path back into a
    # `-framework AGL` flag, and ld — which correctly only consults the SDK —
    # reports it as missing. Nothing warns in between: the failure surfaces at
    # link time in every target that reaches Qt6::Gui, which here is all of
    # them, via Widgets.
    #
    # Both spellings are stripped: the found path, and the bare `-framework
    # AGL` that the same file hard-codes as a fallback on machines where
    # find_library misses the husk entirely. Qt does not need AGL — the
    # `-framework OpenGL` entry beside it is the one that carries the symbols.
    get_target_property(PM_WRAPGL_LIBS WrapOpenGL::WrapOpenGL INTERFACE_LINK_LIBRARIES)
    if (PM_WRAPGL_LIBS)
        list(FILTER PM_WRAPGL_LIBS EXCLUDE REGEX "(/AGL\\.framework/?$)|(^-framework AGL$)")
        set_target_properties(WrapOpenGL::WrapOpenGL PROPERTIES
            INTERFACE_LINK_LIBRARIES "${PM_WRAPGL_LIBS}")
    endif()
endif()

set(SOURCES
    src/main.cpp
    src/core/Config.cpp
    src/core/ApiClient.cpp
    src/core/PriceStream.cpp
    src/core/ChartBridge.cpp
    src/ui/Theme.cpp
    src/ui/LoginDialog.cpp
    src/ui/WatchlistWidget.cpp
    src/ui/WebChartWidget.cpp
    src/ui/ChartArea.cpp
    src/ui/OrderTicket.cpp
    src/ui/AccountPanel.cpp
    src/ui/PositionsPanel.cpp
    src/ui/NewsPanel.cpp
    src/ui/ClosePositionDialog.cpp
    src/ui/ModifyBracketsDialog.cpp
    src/ui/OrderDialog.cpp
    src/ui/EditOrderDialog.cpp
    src/ui/WalletDialog.cpp
    src/ui/MainWindow.cpp
)

set(HEADERS
    src/core/Models.h
    src/core/Config.h
    src/core/ApiClient.h
    src/core/ApiError.h
    src/core/PriceStream.h
    src/core/ChartBridge.h
    src/ui/Theme.h
    src/ui/Icons.h
    src/ui/LoginDialog.h
    src/ui/WatchlistWidget.h
    src/ui/WebChartWidget.h
    src/ui/ChartArea.h
    src/ui/OrderTicket.h
    src/ui/AccountPanel.h
    src/ui/PositionsPanel.h
    src/ui/NewsPanel.h
    src/ui/ClosePositionDialog.h
    src/ui/ModifyBracketsDialog.h
    src/ui/OrderDialog.h
    src/ui/EditOrderDialog.h
    src/ui/WalletDialog.h
    src/ui/MainWindow.h
)

# The one version string for this release. Keep it in step with app.rc's
# VERSIONINFO, installer.iss's AppVersion, and the version in the download
# filename the website links to — they all describe the same build.
set(PM_VERSION "1.0.1")

# App icon + version info. The .rc gives the EXE its icon (Explorer, desktop
# shortcut, taskbar); the .qrc carries the same artwork for setWindowIcon();
# the .icns is the macOS equivalent of the .rc icon (Dock, Finder, Launchpad).
set(RESOURCES resources/app.qrc)
if (WIN32)
    list(APPEND RESOURCES resources/app.rc)
endif()

if (APPLE)
    # A mac app is a bundle named after its executable, so the binary is
    # "Proline Markets Terminal" here rather than the bare "terminal" Windows ships —
    # that name is what Finder, the Dock and ⌘-Tab all show.
    set(PM_APP_NAME "Proline Markets Terminal")
    set(PM_BUNDLE_ID "com.prolinemarket.terminal")

    set(PM_ICNS "${CMAKE_SOURCE_DIR}/resources/prolinemarket.icns")
    if (NOT EXISTS "${PM_ICNS}")
        message(FATAL_ERROR
            "resources/prolinemarket.icns is missing. Generate it first:\n"
            "    ./resources/make-icns.sh")
    endif()
    # MACOSX_PACKAGE_LOCATION puts the file in Contents/Resources, which is
    # where CFBundleIconFile in the plist looks for it.
    set_source_files_properties("${PM_ICNS}" PROPERTIES
        MACOSX_PACKAGE_LOCATION Resources)
    list(APPEND RESOURCES "${PM_ICNS}")

    # Configured by hand rather than relying on CMake's implicit substitution of
    # the MACOSX_BUNDLE_* variables: this way the template is expanded with our
    # own names and an unset variable is visible as a literal @VAR@ instead of
    # silently becoming an empty plist key.
    configure_file("${CMAKE_SOURCE_DIR}/resources/Info.plist.in"
                   "${CMAKE_BINARY_DIR}/Info.plist" @ONLY)
endif()

qt_add_executable(terminal WIN32 MACOSX_BUNDLE ${SOURCES} ${HEADERS} ${RESOURCES})

target_include_directories(terminal PRIVATE src)

if (APPLE)
    set_target_properties(terminal PROPERTIES
        OUTPUT_NAME "${PM_APP_NAME}"
        MACOSX_BUNDLE TRUE
        MACOSX_BUNDLE_INFO_PLIST "${CMAKE_BINARY_DIR}/Info.plist")

    # The web layer (index.html + datafeed + overlay + the vendored charting
    # library) has to travel inside the bundle, or WebChartWidget finds no page
    # and the chart pane comes up empty.
    #
    # Copied POST_BUILD rather than declared as MACOSX_PACKAGE_LOCATION sources:
    # the file list would be fixed at configure time, so a newly added asset —
    # or the whole gitignored web/vendor/ tree, which is often dropped in after
    # the first configure — would be silently left out of every later build.
    #
    # The destination is removed first. `cp -R src/web dst/web` copies the
    # folder *into* dst/web when it already exists and leaves the previous
    # files behind, which is exactly how the Windows build once shipped a stale
    # app.js for several releases (see the note in build-msvc.ps1).
    set(PM_BUNDLE_WEB "$<TARGET_BUNDLE_CONTENT_DIR:terminal>/Resources/web")
    add_custom_command(TARGET terminal POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E rm -rf "${PM_BUNDLE_WEB}"
        COMMAND ${CMAKE_COMMAND} -E copy_directory
                "${CMAKE_SOURCE_DIR}/web" "${PM_BUNDLE_WEB}"
        COMMENT "Copying web/ into the app bundle")
endif()

# Lets WebChartWidget find web/index.html when running from the build tree.
target_compile_definitions(terminal PRIVATE
    PM_SOURCE_WEB_DIR="${CMAKE_SOURCE_DIR}/web")

target_link_libraries(terminal PRIVATE
    Qt6::Widgets
    Qt6::Network
    Qt6::WebSockets
    Qt6::WebEngineWidgets
    Qt6::WebChannel
    Qt6::Svg
)
